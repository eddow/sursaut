import type { NodePath, PluginObj, types as t } from '@babel/core'
import type { JSXElement } from '@babel/types'

interface SursautBabelPluginOptions {
	types: typeof t
}

interface SursautBabelPluginState {
	opts?: Record<string, unknown>
	file?: {
		opts: {
			filename?: string
			cwd?: string
		}
	}
	__sursautHelperLocals?: Partial<Record<CoreHelperName, string>>
}

const EXTENDS_HELPERS = new Set(['_extends', '__assign'])
const CORE_IMPORT_SOURCE = '@sursaut/core'
type CoreHelperName = 'h' | 'Fragment' | 'c' | 'r'

function getProgramPath(path: NodePath): NodePath<t.Program> | null {
	return path.findParent((p: NodePath) => p.isProgram()) as NodePath<t.Program> | null
}

function getCoreImportDeclaration(
	programPath: NodePath<t.Program>
): NodePath<t.ImportDeclaration> | null {
	for (const nodePath of programPath.get('body')) {
		if (nodePath.isImportDeclaration() && nodePath.node.source.value === CORE_IMPORT_SOURCE) {
			return nodePath
		}
	}
	return null
}

function findImportedLocalName(
	t: typeof import('@babel/types'),
	programPath: NodePath<t.Program>,
	helperName: CoreHelperName
): string | null {
	const importDecl = getCoreImportDeclaration(programPath)
	if (!importDecl) return null
	for (const specifier of importDecl.node.specifiers) {
		if (!t.isImportSpecifier(specifier)) continue
		const imported = specifier.imported
		if (t.isIdentifier(imported) && imported.name === helperName) {
			return specifier.local.name
		}
	}
	return null
}

function ensureCoreHelperIdentifier(
	t: typeof import('@babel/types'),
	path: NodePath,
	state: SursautBabelPluginState,
	helperName: CoreHelperName,
	forceAlias = false
): t.Identifier {
	const programPath = getProgramPath(path)
	if (!programPath) return t.identifier(helperName)

	state.__sursautHelperLocals ??= {}
	const cachedLocal = state.__sursautHelperLocals[helperName]
	if (cachedLocal) return t.identifier(cachedLocal)

	const existingLocal = findImportedLocalName(t, programPath, helperName)
	if (existingLocal && (!forceAlias || existingLocal !== helperName)) {
		state.__sursautHelperLocals[helperName] = existingLocal
		return t.identifier(existingLocal)
	}

	const localId = forceAlias
		? programPath.scope.generateUidIdentifier(`sursaut_${helperName}`)
		: t.identifier(helperName)

	const importDecl = getCoreImportDeclaration(programPath)
	const newSpecifier = t.importSpecifier(t.cloneNode(localId), t.identifier(helperName))

	if (importDecl) {
		importDecl.node.specifiers.push(newSpecifier)
	} else {
		programPath.unshiftContainer(
			'body',
			t.importDeclaration([newSpecifier], t.stringLiteral(CORE_IMPORT_SOURCE))
		)
	}

	state.__sursautHelperLocals[helperName] = localId.name
	return t.identifier(localId.name)
}

function isIdentifierFromCoreImport(
	t: typeof import('@babel/types'),
	path: NodePath,
	identifier: t.Identifier,
	importedName: CoreHelperName
): boolean {
	const binding = path.scope.getBinding(identifier.name)
	if (!binding || !binding.path.isImportSpecifier()) return false
	const importDecl = binding.path.parentPath
	if (!importDecl?.isImportDeclaration()) return false
	if (importDecl.node.source.value !== CORE_IMPORT_SOURCE) return false
	const imported = binding.path.node.imported
	return t.isIdentifier(imported) && imported.name === importedName
}

function buildCompositeCall(
	t: typeof import('@babel/types'),
	args: import('@babel/types').CallExpression['arguments'],
	compositeCalleeName: string
) {
	const layers: import('@babel/types').Expression[] = []
	for (const arg of args) {
		if (t.isSpreadElement(arg)) {
			layers.push(t.arrowFunctionExpression([], t.cloneNode(arg.argument)))
		} else if (t.isObjectExpression(arg) && arg.properties.length === 0) {
		} else if (
			t.isCallExpression(arg) &&
			t.isIdentifier(arg.callee, { name: compositeCalleeName })
		) {
			// If it's already a c() call, merge its arguments
			for (const cArg of arg.arguments) {
				if (t.isArrowFunctionExpression(cArg)) {
					layers.push(cArg)
				} else if (t.isExpression(cArg)) {
					layers.push(t.arrowFunctionExpression([], cArg))
				}
			}
		} else if (t.isExpression(arg)) {
			layers.push(t.cloneNode(arg))
		}
	}
	return t.callExpression(t.identifier(compositeCalleeName), layers)
}

export function sursautBabelPlugin({
	types: t,
}: SursautBabelPluginOptions): PluginObj<SursautBabelPluginState> {
	function isSafeExpression(node: t.Expression): boolean {
		let target = node
		// unwrapping type assertions
		while (t.isTSAsExpression(target)) {
			target = target.expression
		}

		if (t.isIdentifier(target)) return true
		if (t.isArrowFunctionExpression(target)) return true
		if (t.isFunctionExpression(target)) return true

		// Check for literals but exclude TemplateLiteral as requested
		if (t.isStringLiteral(target)) return true
		if (t.isNumericLiteral(target)) return true
		if (t.isBooleanLiteral(target)) return true
		if (t.isNullLiteral(target)) return true

		// Check for Objects
		if (t.isObjectExpression(target)) {
			return target.properties.every((prop) => {
				if (t.isObjectMethod(prop)) return true
				if (t.isSpreadElement(prop)) return false // Conservative: spread might be reactive
				if (t.isObjectProperty(prop)) {
					if (prop.computed && !isSafeExpression(prop.key as t.Expression)) return false
					return t.isExpression(prop.value) && isSafeExpression(prop.value as t.Expression)
				}
				return false
			})
		}

		// Check for Arrays
		if (t.isArrayExpression(target)) {
			return target.elements.every((elem) => {
				if (elem === null) return true // Sparse array hole
				if (t.isSpreadElement(elem)) return false
				return t.isExpression(elem) && isSafeExpression(elem as t.Expression)
			})
		}

		// Other Literals and Function-likes
		if (t.isRegExpLiteral(target)) return true
		if (t.isBigIntLiteral(target)) return true
		if (t.isClassExpression(target)) return true

		// Recursive Expressions
		// Unary: !safe, -safe, typeof safe
		if (t.isUnaryExpression(target)) {
			return isSafeExpression(target.argument)
		}

		// Binary: safe + safe, safe * safe
		if (t.isBinaryExpression(target)) {
			return (
				t.isExpression(target.left) &&
				isSafeExpression(target.left as t.Expression) &&
				t.isExpression(target.right) &&
				isSafeExpression(target.right as t.Expression)
			)
		}

		// Logical: safe && safe, safe || safe
		if (t.isLogicalExpression(target)) {
			return isSafeExpression(target.left) && isSafeExpression(target.right)
		}

		// Conditional (Ternary): safe ? safe : safe
		if (t.isConditionalExpression(target)) {
			return (
				isSafeExpression(target.test) &&
				isSafeExpression(target.consequent) &&
				isSafeExpression(target.alternate)
			)
		}

		return false
	}

	function ensureImports(path: NodePath, ...names: string[]) {
		const programPath = getProgramPath(path)
		if (!programPath) return

		const ensureImport = (name: string) => {
			const alreadyImported = programPath.node.body.some(
				(node: t.Statement) =>
					t.isImportDeclaration(node) &&
					node.source.value === CORE_IMPORT_SOURCE &&
					node.specifiers.some(
						(
							specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier
						) => t.isImportSpecifier(specifier) && specifier.local.name === name
					)
			)
			if (alreadyImported) return

			const importDeclaration = programPath.node.body.find(
				(node: t.Statement): node is t.ImportDeclaration =>
					t.isImportDeclaration(node) && node.source.value === CORE_IMPORT_SOURCE
			)

			if (importDeclaration) {
				importDeclaration.specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)))
			} else {
				programPath.unshiftContainer(
					'body',
					t.importDeclaration(
						[t.importSpecifier(t.identifier(name), t.identifier(name))],
						t.stringLiteral(CORE_IMPORT_SOURCE)
					)
				)
			}
		}

		for (const name of names) ensureImport(name)
	}

	function isMutableBinding(path: NodePath, name: string): boolean {
		const binding = path.scope.getBinding(name)
		return !!binding && (binding.kind === 'let' || binding.kind === 'var')
	}

	// Wrap JSX expression-container children (e.g. `{expr}`) in `r(() => expr)` so the
	// reactive read happens in a child effect rather than the render effect body.
	// Applied to both JSXElement and JSXFragment children — without it, fragment
	// children would read reactive props during the component body and trip the
	// rebuild fence.
	function wrapReactiveChildren(
		path: NodePath<t.JSXElement | t.JSXFragment>,
		state: SursautBabelPluginState
	) {
		const children = path.node.children as (
			| t.JSXText
			| t.JSXExpressionContainer
			| t.JSXElement
			| t.JSXFragment
		)[]
		for (let index = 0; index < children.length; index++) {
			const child = children[index]
			if (t.isJSXExpressionContainer(child)) {
				const expression = child.expression
				if (!t.isJSXEmptyExpression(expression)) {
					const reactiveHelper = ensureCoreHelperIdentifier(t, path, state, 'r', true)
					const arrowFunction = t.arrowFunctionExpression([], expression)
					children[index] = t.jsxExpressionContainer(
						t.callExpression(t.cloneNode(reactiveHelper), [arrowFunction])
					)
				}
			}
		}
	}

	return {
		name: 'sursaut-babel',
		visitor: {
			LabeledStatement(path: NodePath<t.LabeledStatement>) {
				if (path.node.label.name !== 'bind') return
				throw path.buildCodeFrameError(
					'[bind] `bind:` label syntax was removed from @sursaut/core; use bind(...) directly'
				)
			},
			JSXFragment(path: NodePath<t.JSXFragment>, state: SursautBabelPluginState) {
				ensureImports(path, 'h', 'Fragment')
				wrapReactiveChildren(path, state)
			},
			JSXElement(path: NodePath<JSXElement>, state: SursautBabelPluginState) {
				ensureImports(path, 'h')
				// Traverse all JSX children and attributes
				wrapReactiveChildren(path, state)

				// Also check props (e.g., `<Component prop={this.counter} />`)
				if (t.isJSXOpeningElement(path.node.openingElement)) {
					// Pass 1: support `update:attr` paired with base `attr`
					const attrs = path.node.openingElement.attributes
					for (let i = 0; i < attrs.length; i++) {
						const attr = attrs[i]
						if (t.isJSXAttribute(attr) && t.isJSXNamespacedName(attr.name)) {
							const ns = attr.name.namespace.name
							const local = attr.name.name.name
							if (ns === 'update') {
								const baseIndex = attrs.findIndex(
									(a: t.JSXAttribute | t.JSXSpreadAttribute) =>
										t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === local
								)
								if (baseIndex !== -1) {
									const baseAttr = attrs[baseIndex] as t.JSXAttribute
									// getter from base
									let getterExpr: t.Expression | null = null
									if (baseAttr.value == null) {
										getterExpr = t.booleanLiteral(true)
									} else if (
										t.isStringLiteral(baseAttr.value) ||
										t.isNumericLiteral(baseAttr.value) ||
										t.isBooleanLiteral(baseAttr.value)
									) {
										getterExpr = baseAttr.value
									} else if (t.isJSXExpressionContainer(baseAttr.value)) {
										const exp = baseAttr.value.expression
										if (!t.isJSXEmptyExpression(exp)) getterExpr = exp
									}
									// setter from update:attr
									let setterExpr: t.Expression | null = null
									if (t.isJSXExpressionContainer(attr.value)) {
										const exp = attr.value.expression
										if (
											!t.isJSXEmptyExpression(exp) &&
											(t.isArrowFunctionExpression(exp) || t.isFunctionExpression(exp))
										) {
											setterExpr = exp
										}
									}
									if (getterExpr && setterExpr) {
										const reactiveHelper = ensureCoreHelperIdentifier(t, path, state, 'r', true)
										const getter = t.arrowFunctionExpression([], getterExpr)
										const bindingObject = t.callExpression(t.cloneNode(reactiveHelper), [
											getter,
											setterExpr,
										])
										baseAttr.value = t.jsxExpressionContainer(bindingObject)
										ensureImports(path, 'r')
										// remove update:attr
										attrs.splice(i, 1)
										i--
									}
								}
							}
						}
					}

					// Pass 2: spread + regular reactive attribute transforms
					for (const attr of path.node.openingElement.attributes) {
						if (t.isJSXSpreadAttribute(attr)) {
							const compositeHelper = ensureCoreHelperIdentifier(t, path, state, 'c', true)
							attr.argument = t.callExpression(t.cloneNode(compositeHelper), [
								t.arrowFunctionExpression([], t.cloneNode(attr.argument)),
							])
						} else if (t.isJSXAttribute(attr)) {
							if (t.isJSXExpressionContainer(attr.value)) {
								const expression = attr.value.expression
								if (!t.isJSXEmptyExpression(expression)) {
									let innerExpression = expression
									if (t.isTSAsExpression(expression)) {
										innerExpression = expression.expression
									}
									if (t.isJSXIdentifier(attr.name) && attr.name.name === 'this') {
										if (
											t.isArrowFunctionExpression(innerExpression) ||
											t.isFunctionExpression(innerExpression)
										) {
											attr.value = t.jsxExpressionContainer(expression)
										} else if (t.isLVal(innerExpression)) {
											const setter = t.arrowFunctionExpression(
												[t.identifier('mounted')],
												t.assignmentExpression(
													'=',
													innerExpression as t.LVal,
													t.identifier('mounted')
												)
											)
											attr.value = t.jsxExpressionContainer(setter)
										} else {
											throw path.buildCodeFrameError(
												`[jsx-reactive] The value of 'this' attribute must be a callback or assignable expression (LVal), got ${innerExpression.type}`
											)
										}
									} else if (
										t.isMemberExpression(innerExpression) ||
										(t.isIdentifier(innerExpression) &&
											isMutableBinding(path, innerExpression.name))
									) {
										const reactiveHelper = ensureCoreHelperIdentifier(t, path, state, 'r', true)
										if (
											t.isCallExpression(expression) &&
											t.isIdentifier(expression.callee, { name: reactiveHelper.name })
										) {
											continue
										}
										const getter = t.arrowFunctionExpression([], expression)
										const setter = t.arrowFunctionExpression(
											[t.identifier('val')],
											t.assignmentExpression('=', innerExpression, t.identifier('val'))
										)
										attr.value = t.jsxExpressionContainer(
											t.callExpression(t.cloneNode(reactiveHelper), [getter, setter])
										)
									} else {
										if (!isSafeExpression(innerExpression as t.Expression)) {
											const reactiveHelper = ensureCoreHelperIdentifier(t, path, state, 'r', true)
											if (
												t.isCallExpression(expression) &&
												t.isIdentifier(expression.callee, { name: reactiveHelper.name })
											) {
												continue
											}
											attr.value = t.jsxExpressionContainer(
												t.callExpression(t.cloneNode(reactiveHelper), [
													t.arrowFunctionExpression([], expression),
												])
											)
										}
									}
								}
							}
						}
					}
				}
			},
		},
	}
}

export function sursautSpreadPlugin({
	types: t,
}: SursautBabelPluginOptions): PluginObj<SursautBabelPluginState> {
	function isAttributesMergeCall(path: NodePath<t.CallExpression>): boolean {
		const parentPath = path.parentPath
		if (!parentPath || !parentPath.isCallExpression()) return false
		if (!t.isIdentifier(parentPath.node.callee)) return false
		return (
			isIdentifierFromCoreImport(t, parentPath, parentPath.node.callee, 'h') &&
			parentPath.node.arguments[1] === path.node
		)
	}

	return {
		name: 'sursaut-spread',
		visitor: {
			CallExpression(path: NodePath<t.CallExpression>, state: SursautBabelPluginState) {
				const callee = path.node.callee
				let shouldTransform = false
				if (t.isIdentifier(callee) && EXTENDS_HELPERS.has(callee.name)) {
					shouldTransform = true
				} else if (
					t.isMemberExpression(callee) &&
					t.isIdentifier(callee.object, { name: 'Object' }) &&
					t.isIdentifier(callee.property, { name: 'assign' })
				) {
					shouldTransform = true
				}
				if (!shouldTransform) return
				if (!isAttributesMergeCall(path)) return
				if (!path.node.arguments.length) return
				const compositeHelper = ensureCoreHelperIdentifier(t, path, state, 'c', true)
				path.replaceWith(buildCompositeCall(t, path.node.arguments, compositeHelper.name))
			},
		},
	}
}
