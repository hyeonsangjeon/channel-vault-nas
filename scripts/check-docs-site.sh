#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-site}"

require_text() {
  local file="$1"
  local text="$2"
  local label="$3"

  if [[ ! -f "$file" ]]; then
    printf 'missing generated public file: %s\n' "$file" >&2
    exit 1
  fi

  if ! grep -Fq "$text" "$file"; then
    printf 'missing %s in %s\n' "$label" "$file" >&2
    exit 1
  fi
}

require_text "$SITE_DIR/index.html" 'property="og:image"' 'Open Graph image'
require_text "$SITE_DIR/index.html" 'name="twitter:card" content="summary_large_image"' 'large Twitter card'
require_text "$SITE_DIR/index.html" 'application/ld+json' 'structured data'
require_text "$SITE_DIR/index.html" 'YouTube Channel Backup for NAS' 'search-focused English title'
require_text "$SITE_DIR/ko/index.html" 'NAS용 YouTube 채널 백업' 'search-focused Korean title'
require_text "$SITE_DIR/robots.txt" 'Sitemap: https://hyeonsangjeon.github.io/channel-vault-nas/sitemap.xml' 'sitemap directive'
require_text "$SITE_DIR/llms.txt" 'Open-source, self-hosted YouTube channel backup' 'LLM product summary'
require_text "$SITE_DIR/sitemap.xml" '<loc>https://hyeonsangjeon.github.io/channel-vault-nas/</loc>' 'canonical home URL'
require_text "$SITE_DIR/about/project-kit/index.html" 'Verified facts' 'English project facts'
require_text "$SITE_DIR/ko/about/project-kit/index.html" '검증된 정보' 'Korean project facts'

printf 'ok: public search metadata verified in %s\n' "$SITE_DIR"
