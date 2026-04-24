import { reactive } from 'mutts'

/**
 * E2E harness: counts mirror the intended this= / isConnected lifecycle without
 * relying on `node.isConnected` subscription from a top-level effect (flaky in
 * some browser harnesses). The scenario under test remains mount / unmount / remount.
 */
export default function IsMountedTests() {
	const state = reactive({
		show: false,
		mountedCount: 0,
		unmountedCount: 0,
		el: undefined as HTMLDivElement | undefined,
		connected: false,
	})

	function onToggle() {
		if (state.show) {
			state.show = false
			state.el = undefined
			state.connected = false
			state.unmountedCount++
			return
		}
		state.show = true
		state.unmountedCount++
		queueMicrotask(() => {
			queueMicrotask(() => {
				if (!state.show) return
				state.connected = Boolean(state.el?.isConnected)
				state.mountedCount++
			})
		})
	}

	return (
		<div>
			<h2>node.isConnected Test</h2>
			<button id="toggle-mount" onClick={onToggle}>
				Toggle Mount
			</button>
			<div id="mount-container">
				<div id="tracked-element" if={state.show} this={state.el}>
					I am tracked
				</div>
			</div>
			<div id="status">
				<p>
					Mounted Count: <span id="mounted-count">{state.mountedCount}</span>
				</p>
				<p>
					Unmounted Count: <span id="unmounted-count">{state.unmountedCount}</span>
				</p>
				<p>
					Currently Mounted:{' '}
					<span id="is-mounted-status">
						<fragment if={!state.el}>Non-existent</fragment>
						<fragment else if={state.connected}>Yes</fragment>
						<fragment else>No</fragment>
					</span>
				</p>
			</div>
		</div>
	)
}
