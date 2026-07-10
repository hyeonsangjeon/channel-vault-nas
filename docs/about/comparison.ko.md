# Channel Vault NAS가 나에게 맞을까요?

모든 사람에게 가장 좋은 유튜브 아카이버는 없습니다. NAS에서 오래 사용할 흐름을
기준으로 고르세요.

| 이런 경우 | 먼저 살펴볼 도구 |
| --- | --- |
| 완성도 높은 미디어 서버, 검색, 재생, 큰 사용자 커뮤니티가 중요함 | [TubeArchivist](https://github.com/tubearchivist/tubearchivist) |
| 단순하고 성숙한 구독 다운로드 흐름이 필요함 | [Pinchflat](https://github.com/kieraneglin/pinchflat) |
| 채널 구독과 파일시스템 중심 다운로드가 필요함 | [TubeSync](https://github.com/meeb/tubesync) 또는 [ytdl-sub](https://github.com/jmbannon/ytdl-sub) |
| 기존 NAS 폴더나 `archive.txt`가 있고, 건너뜀/누락 판단을 직접 보며 디스크에서 복구하고 싶음 | **Channel Vault NAS** |

## Channel Vault가 강한 부분

- 기존 아카이브를 일부러 다시 받지 않고 가져오기
- `archive.txt` 판단을 화면에서 확인하고 검토하기
- 파일시스템을 영구 데이터로, 데이터베이스를 재구축 가능한 색인으로 다루기
- 채널 동기화, 제한된 자동 다운로드, 큐 감사, 스토리지 복구를 하나의 운영 콘솔에
  모으기

## 지금은 다른 도구가 더 맞을 수 있는 경우

- 성숙한 인앱 재생 환경이나 매우 큰 사용자 커뮤니티가 필요합니다.
- 쿠키 또는 인증된 비공개 영상 수집이 필요합니다. Channel Vault는 아직 지원되는
  쿠키 입력 흐름을 제공하지 않습니다.
- 운영 화면이 거의 없는 가장 작은 다운로드 도구를 원합니다.

Channel Vault는 아카이브 운영 콘솔입니다. Plex/Jellyfin을 대체하거나 원본 서비스의
접근 제어를 우회하는 도구가 아닙니다. 본인이 소유했거나 보관 권한이 있는 콘텐츠에
사용하세요.
