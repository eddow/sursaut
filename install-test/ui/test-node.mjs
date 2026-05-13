// Test that @sursaut/ui can be imported from the .tgz
// NOTE: The main @sursaut/ui barrel transitively imports CSS (via ./palette),
// so pure Node.js tests use safe subpaths (@sursaut/ui/models, @sursaut/ui/dockview).

// === Models subpath (CSS-free, pure logic) ===
import {
  buttonModel,
  checkboxModel,
  checkButtonModel,
  radioButtonModel,
  accordionModel,
  selectModel,
  comboboxModel,
  multiselectModel,
  menuModel,
  progressModel,
  starsModel,
  chipModel,
  themeToggleModel,
  stackModel,
  gridModel,
} from '@sursaut/ui/models'

// Verify models exist and return objects with expected shape
const btn = buttonModel({})
if (typeof btn !== 'object' || btn === null) {
  console.error('FAIL: buttonModel did not return an object')
  process.exit(1)
}
if (!btn.button || typeof btn.button !== 'object') {
  console.error('FAIL: buttonModel missing button group')
  process.exit(1)
}

const cb = checkboxModel({})
if (typeof cb !== 'object' || cb === null) {
  console.error('FAIL: checkboxModel did not return an object')
  process.exit(1)
}

const ckb = checkButtonModel({})
if (typeof ckb !== 'object' || ckb === null) {
  console.error('FAIL: checkButtonModel did not return an object')
  process.exit(1)
}

const rdb = radioButtonModel({})
if (typeof rdb !== 'object' || rdb === null) {
  console.error('FAIL: radioButtonModel did not return an object')
  process.exit(1)
}

const acc = accordionModel({})
if (typeof acc !== 'object' || acc === null) {
  console.error('FAIL: accordionModel did not return an object')
  process.exit(1)
}

const sel = selectModel({})
if (typeof sel !== 'object' || sel === null) {
  console.error('FAIL: selectModel did not return an object')
  process.exit(1)
}

const combo = comboboxModel({})
if (typeof combo !== 'object' || combo === null) {
  console.error('FAIL: comboboxModel did not return an object')
  process.exit(1)
}

const multi = multiselectModel({})
if (typeof multi !== 'object' || multi === null) {
  console.error('FAIL: multiselectModel did not return an object')
  process.exit(1)
}

const menu = menuModel({})
if (typeof menu !== 'object' || menu === null) {
  console.error('FAIL: menuModel did not return an object')
  process.exit(1)
}

const prog = progressModel({ value: 50, max: 100 })
if (typeof prog !== 'object' || prog === null) {
  console.error('FAIL: progressModel did not return an object')
  process.exit(1)
}

const stars = starsModel({ count: 5 })
if (typeof stars !== 'object' || stars === null) {
  console.error('FAIL: starsModel did not return an object')
  process.exit(1)
}

const chip = chipModel({})
if (typeof chip !== 'object' || chip === null) {
  console.error('FAIL: chipModel did not return an object')
  process.exit(1)
}

const tt = themeToggleModel({})
if (typeof tt !== 'object' || tt === null) {
  console.error('FAIL: themeToggleModel did not return an object')
  process.exit(1)
}

const stack = stackModel({})
if (typeof stack !== 'object' || stack === null) {
  console.error('FAIL: stackModel did not return an object')
  process.exit(1)
}

const grid = gridModel({})
if (typeof grid !== 'object' || grid === null) {
  console.error('FAIL: gridModel did not return an object')
  process.exit(1)
}

// Test buttonModel with icon
const btnWithIcon = buttonModel({ icon: 'star' })
if (!btnWithIcon.icon) {
  console.error('FAIL: buttonModel with icon should have icon property')
  process.exit(1)
}
if (btnWithIcon.icon.position !== 'start') {
  console.error('FAIL: buttonModel icon default position should be start')
  process.exit(1)
}

// Test buttonModel disabled
const btnDisabled = buttonModel({ disabled: true })
if (!btnDisabled.button?.disabled) {
  console.error('FAIL: buttonModel disabled should set button.disabled')
  process.exit(1)
}

// Test progressModel
if (prog.progress?.value !== 50) {
  console.error('FAIL: progressModel value mismatch')
  process.exit(1)
}
if (prog.progress?.max !== 100) {
  console.error('FAIL: progressModel max mismatch')
  process.exit(1)
}

// Test chipModel dismissible
if (typeof chip.dismiss !== 'function') {
  console.error('FAIL: chipModel.dismiss is not a function')
  process.exit(1)
}
if (chip.isVisible !== true) {
  console.error('FAIL: chipModel.isVisible should default to true')
  process.exit(1)
}

// === Dockview subpath (optional peer dep: dockview-core, browser-only) ===
try {
  const dockview = await import('@sursaut/ui/dockview')
  if (typeof dockview.Dockview !== 'function') {
    console.error('FAIL: Dockview is not a function')
    process.exit(1)
  }
  if (typeof dockview.DockviewRouter !== 'function') {
    console.error('FAIL: DockviewRouter is not a function')
    process.exit(1)
  }
  console.log('✓ Dockview, DockviewRouter accessible')
} catch (err) {
  if (err.code === 'ERR_MODULE_NOT_FOUND') {
    console.log('⚠ Dockview subpath skipped: optional peer dep dockview-core not installed (browser-only)')
  } else {
    throw err
  }
}

console.log('PASS: @sursaut/ui node entry works')
console.log('✓ Package installed from .tgz')
console.log('✓ All model exports accessible')
console.log('✓ buttonModel works (basic, icon, disabled)')
console.log('✓ checkboxModel, checkButtonModel, radioButtonModel work')
console.log('✓ accordionModel works')
console.log('✓ selectModel, comboboxModel, multiselectModel work')
console.log('✓ menuModel works')
console.log('✓ progressModel works')
console.log('✓ starsModel works')
console.log('✓ chipModel works (dismiss, isVisible)')
console.log('✓ themeToggleModel works')
console.log('✓ stackModel, gridModel work')
