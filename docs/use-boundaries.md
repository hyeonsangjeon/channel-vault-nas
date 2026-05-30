# Channel Vault NAS Use Boundaries

작성일: 2026-05-30

## Product Frame

Channel Vault NAS is a personal NAS archive manager for creator-owned media,
user-authorized channel backups, Google Takeout exports, and existing local
media folders.

The product should not be framed as a public ripping service, circumvention
tool, or bulk downloader for content the user has no right to preserve.

## Supported Lanes

- **Google Takeout import**: first-class lane for creator-owned exports.
- **Existing NAS folder scan**: import media, sidecars, thumbnails, subtitles,
  and NFO files already present on disk.
- **Authorized channel sync**: sync sources the user has rights or permission to
  archive.
- **Metadata preservation**: store `video.info.json`, thumbnails, subtitles, and
  relative paths so the archive can be rebuilt from the filesystem.

## Product Language

Prefer:

- creator backup
- personal archive
- authorized channel sync
- Takeout import
- NAS library
- metadata preservation
- restore kit

Avoid:

- ripper
- bypass
- pirate
- scrape everything
- unrestricted downloader

## Implementation Guardrails

- Do not use YouTube Data API as a media download engine.
- Keep Google API integration optional and metadata-oriented.
- Keep download/sync policy explicit per source.
- Surface that users are responsible for archiving only content they have the
  rights or permission to preserve.
- Store filesystem-relative paths and sidecars so imports and recovery are
  possible without a live service account.

