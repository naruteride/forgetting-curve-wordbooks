export const sharedStyles = `
	:host {
		color: #17201b;
		display: block;
	}

	* {
		box-sizing: border-box;
	}

	button,
	input,
	select,
	textarea {
		font: inherit;
	}

	button {
		border: 0;
		border-radius: 8px;
		cursor: pointer;
		min-height: 44px;
		padding: 0.75rem 1rem;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease,
			transform 160ms ease;
	}

	button:hover {
		transform: translateY(-1px);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
		transform: none;
	}

	input,
	select,
	textarea {
		background: #fffefb;
		border: 1px solid #d8d2c4;
		border-radius: 8px;
		color: #17201b;
		min-height: 44px;
		padding: 0.75rem 0.85rem;
		width: 100%;
	}

	textarea {
		line-height: 1.5;
		min-height: 92px;
		resize: vertical;
	}

	label {
		color: #3a403b;
		display: grid;
		font-size: 0.94rem;
		font-weight: 650;
		gap: 0.45rem;
	}

	:focus-visible {
		outline: 3px solid #2f7d68;
		outline-offset: 3px;
	}

	.primary {
		background: #1f6f5b;
		color: white;
	}

	.primary:hover {
		background: #195b4b;
	}

	.secondary {
		background: #ebe6dc;
		color: #17201b;
	}

	.secondary:hover {
		background: #ded7c9;
	}

	.danger {
		background: #ab3f3f;
		color: white;
	}

	.danger:hover {
		background: #8f3131;
	}

	.ghost {
		background: transparent;
		border: 1px solid #d8d2c4;
		color: #25312c;
	}

	.ghost:hover {
		background: #f1ede4;
	}

	.icon {
		align-items: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 999px;
		display: inline-flex;
		font-weight: 800;
		height: 44px;
		justify-content: center;
		min-height: 44px;
		padding: 0;
		width: 44px;
	}

	.icon:hover {
		background: #eee8dd;
		border-color: #d8d2c4;
	}

	.stack {
		display: grid;
		gap: 1rem;
	}

	.cluster {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.spread {
		align-items: center;
		display: flex;
		gap: 1rem;
		justify-content: space-between;
	}

	.panel {
		background: rgba(255, 254, 251, 0.86);
		border: 1px solid #e4ddcf;
		border-radius: 8px;
		padding: clamp(1rem, 2vw, 1.5rem);
	}

	.muted {
		color: #656b64;
	}

	.error {
		color: #9a2f2f;
		font-weight: 650;
	}

	.empty {
		border: 1px dashed #cfc6b6;
		border-radius: 8px;
		color: #656b64;
		padding: 2rem;
		text-align: center;
	}

	dialog {
		background: #fffefb;
		border: 1px solid #d8d2c4;
		border-radius: 8px;
		box-shadow: 0 24px 80px rgba(23, 32, 27, 0.22);
		color: #17201b;
		max-width: min(94vw, 560px);
		padding: 0;
		width: 100%;
	}

	dialog::backdrop {
		background: rgba(23, 32, 27, 0.32);
		backdrop-filter: blur(2px);
	}

	.dialog-body {
		display: grid;
		gap: 1rem;
		padding: clamp(1rem, 3vw, 1.5rem);
	}

	.dialog-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.001ms !important;
			animation-iteration-count: 1 !important;
			scroll-behavior: auto !important;
			transition-duration: 0.001ms !important;
		}
	}
`;
