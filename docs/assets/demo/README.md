# Demo Assets

Generated public demo recordings live here during release prep.

Create the deterministic WebM from the seeded Playwright fixture:

```bash
scripts/capture-public-demo.sh
```

The default video output is `docs/assets/demo/channel-vault-public-alpha.webm`.
When `ffmpeg` is available, the same command trims the loading frames and
refreshes the compact README GIF automatically.

The reviewed README tour GIF is the checked-in animation:

- `channel-vault-public-alpha.gif`
