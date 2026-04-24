#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/sandbox/packs"
mkdir -p "$OUT"
for rel in packages/core packages/kit packages/ui packages/adapters/pico packages/pure-glyf; do
	(
		cd "$ROOT/$rel"
		pnpm pack --pack-destination "$OUT"
	)
done
echo "Packed publishable packages into $OUT"
