> DEPRECATED — DO NOT FOLLOW FOR v4
> 旧クラウド版の履歴資料です。現行仕様は ../PROMPT_TREE_MASTER_SPEC_v4_LOCAL_OFFLINE.md です。

# ============================================================
# PROMPT TREE
# iPhone-first Image Generation Prompt Research PWA
# CODEX IMPLEMENTATION MASTER PROMPT
# COMPLETE REPLACEMENT EDITION
# Version 3.0
# ============================================================

> **重要:** このファイルは、途中で途切れた旧版（0〜536項目までのドラフト）を**全面的に上書きする完全版**です。  
> 旧版の要件を捨てるものではなく、これまで確定したユーザー要件を再統合し、矛盾を整理し、Codexが実装判断しやすい形へ機械的に落とし込んだものです。  
> このファイル単体をCodexへ渡してください。旧版と併用する必要はありません。

---

# 0. ROLE / EXECUTION MODE

あなたは、このプロジェクトの以下の役割を兼任してください。

- Lead Product Engineer
- Senior Frontend Engineer
- Senior Backend Engineer
- Cloudflare Architect
- Mobile Web / iOS PWA UX Engineer
- Database Designer
- Security Engineer
- Performance Engineer
- QA Engineer
- Release Engineer

以下の仕様は「参考案」ではありません。原則として**実装要件**です。

このプロジェクトの中心は、一般的なCRUD管理画面ではありません。  
Notion、Excel、CMS、デスクトップ向け管理ツールをスマートフォン幅へ縮めただけのUIにはしないでください。

このアプリの本質は、

**「iPhoneで、生成画像とPromptの派生関係を直感的に保存・閲覧・比較・研究するための専用PWA」**

です。

実装中、軽微な判断はユーザーへ逐一質問せず、合理的に進めてください。  
ただし、以下のいずれかに該当する場合のみ重大ブロッカーとして報告してください。

1. データ消失の危険が高い
2. セキュリティモデルの根本変更が必要
3. Cloudflareの無料〜低コスト構成から大きく逸脱する
4. iPhone中心UXの中核要件を技術的に満たせない
5. 既存リポジトリや本番環境を破壊する危険がある
6. 本仕様同士に実装不能な矛盾がある

「設計だけ」「モックだけ」「TODOを大量に残す」「画面だけ作って保存できない」といった状態で終了しないでください。  
**実際に動くアプリを完成させること**が目的です。

---

# 1. PRODUCT NAME

開発中の仮称は以下です。

**Prompt Tree**

ただし最終名称は未決定です。

アプリ名は必ず一か所の設定から変更できるようにしてください。

例:

```ts
export const APP_NAME = "Prompt Tree";
```

ソースコード全体に `"Prompt Tree"` をハードコードしないでください。

PWA Manifest、Lock画面、About、ヘッダー、Export名なども可能な限り共通設定を参照してください。

---

# 2. PRODUCT PURPOSE

このアプリは画像生成AIそのものではありません。

ユーザーはChatGPTなど外部サービスで、

1. Promptを書く
2. 画像を生成する
3. Promptを追加・変更する
4. 派生画像を生成する
5. 比較する
6. さらに派生させる

という実験を繰り返します。

Prompt Treeでは、その研究結果を以下とともに保存します。

- 生成画像
- Full Prompt
- Delta Prompt（親から追加・変更したPrompt）
- タイトル
- ID
- メモ
- AI Provider
- Model
- Rating
- Tags
- 生成日時等の任意Metadata
- 親子関係
- 複数親
- 参考接続
- キャンバス位置
- シリーズ
- 1つのPromptから生成された複数画像

ユーザーが後から、

**「どのPromptから、どの画像が、どう派生したか」**

を直感的に追跡できることが主目的です。

---

# 3. MVP SCOPE / NON-MVP

## 3.1 MVPで実装する

- Series / Root Card
- Child Card
- 1 Cardに1〜複数画像
- Full Prompt
- Delta Prompt
- Memo
- AI Provider
- Model
- Tags
- Rating
- 画像Favorite
- Infinite Tree Canvas
- 複数Parent
- Primary Parent
- Reference Edge
- Edge Color
- HOME Grid
- HOME手動並び替え
- 写真アプリ風Image Grid
- Search
- PIN Lock
- 複数端末同期
- PWA
- Cloudflare D1
- Cloudflare R2
- Export
- 基本Offline閲覧
- iPhone縦画面最適化
- TREEのみ横画面対応
- Undo / Redo
- Card Move between Series
- Card Duplicate
- Image replace/add/delete/reorder
- 10,000画像を想定したPagination / Virtualization

## 3.2 MVPでは実装しない

- アプリ内からAI画像を生成
- OpenAI API等の画像生成APIキー管理
- 複数ユーザー
- SNS
- Public Sharing
- Comments
- Collaboration / realtime cursors
- 30日ゴミ箱UI
- 完全Restore
- Branch全体複製
- AI自動タイトル生成
- AI自動評価
- AI自動Prompt解析
- Prompt自動改善
- 課金システム

将来機能が追加しやすい設計は歓迎しますが、MVPの安定性を優先してください。

---

# 4. TARGET DEVICES

最重要ターゲット:

**iPhone**

優先順位:

1. iPhone PWA
2. iPhone Safari
3. iPad
4. Windows PC browser

PC向け画面を作ってから縮めるのではなく、最初からiPhone基準で設計してください。

## 4.1 Orientation

通常画面:

- HOME
- DETAIL
- IMAGES
- SEARCH
- SETTINGS

は縦画面優先。

TREE:

- Portrait
- Landscape

両対応。

画面回転時にCard座標を書き換えないでください。Viewportだけ合理的に再計算し、ユーザーが見ていた領域を大きく失わないようにしてください。

---

# 5. REQUIRED STACK

原則:

## Frontend

- React
- TypeScript
- Vite
- React Router

## PWA

- Web App Manifest
- Service Worker
- `vite-plugin-pwa` 等を利用可
- `display: standalone`
- `viewport-fit=cover`

## Infinite Canvas

- `@xyflow/react` / React Flow

## Backend

- Cloudflare Workers または Pages Functions

## DB

- Cloudflare D1

## Images

- Cloudflare R2

## Local Cache

- IndexedDB
- 必要ならDexie等

## State

- React state
- Zustand等の軽量Store
- Server stateにTanStack Queryを使ってよい

## Validation

- Zod等を推奨

## Drag & Drop

- dnd-kit等を利用可

## Image Viewer

- PhotoSwipe等、iOSで実績のあるViewerを優先

## Virtualization

- TanStack Virtual等を利用可

## Testing

- Vitest
- React Testing Library
- Playwright

依存ライブラリを不要に増やさないでください。  
ただし、Pinch Zoom / Infinite Canvas / DnDを不安定な独自実装にするくらいなら、成熟したライブラリを使ってください。

---

# 6. GLOBAL NON-NEGOTIABLE RULES

以下は絶対条件です。

1. iPhone-first
2. 画像が主役
3. TREEでは原寸画像を並べない
4. TREE CardはThumbnail中心
5. TREE上にFull Promptを表示しない
6. HOME上にもPromptを表示しない
7. Card Tapで初めて詳細を開く
8. DetailからBackしたときTREEのViewportを維持
9. 1 Card = 1 generation experiment
10. 1 Card = 1 image ではない
11. 同一Promptから5画像 → Card 1個 + Images 5枚
12. TREEでは上記Cardは1個
13. IMAGESでは上記5枚は5セル
14. Original画像は勝手に圧縮しない
15. HOMEはGrid
16. TREEはInfinite Canvas
17. SeriesごとにTREEは独立
18. 複数Parent対応
19. Primary Parentを1つ指定可
20. Parent以外のReference Edge可
21. Edgeは色分け可
22. Edge LabelはMVP不要
23. PIN Lock
24. Owner 1名
25. 複数端末同期
26. 5分無操作で再Lock
27. Face ID相当は無料で安定実装できる場合のみWebAuthn/Passkeyで追加
28. Offlineは基本閲覧のみ
29. 画像10,000枚規模を設計目標
30. Dark Mode
31. Safe Area対応
32. TREEではページ自体を1pxもScrollさせない
33. Back先が曖昧な画面を作らない
34. Public R2 URLを恒久公開しない
35. 4桁PINだけをクラウド本人認証に使わない

---

# 7. CORE DOMAIN TERMINOLOGY

実装内の用語を統一してください。

## Series

大項目コンテナ。

例:

- A Series
- B Series
- PORTRAIT Series

Series自体はPromptや画像を重複保持しません。

## Root Card

Series最初の生成実験。

例:

- A-000

HOMEに表示される大項目カードは実質Root Cardです。

## Child Card

Rootから派生した、または同Series内へ独立追加した生成実験。

例:

- A-001
- A-002

## Card

1回の生成実験。

1 Cardに複数画像を持てます。

## Card Image

Cardに所属する個々の画像。

## Parent Edge

生成上の親子関係。

## Reference Edge

親子ではない「比較・参考・関連」接続。

## Primary Parent

複数Parentのうち中心となる1つ。

---

# 8. ID MODEL

内部IDと表示IDを必ず分離してください。

## Internal ID

UUID。

例:

```text
550e8400-e29b-41d4-a716-446655440000
```

URL、DB relation、R2 path等は原則Internal IDを使います。

## Display ID

ユーザーが見るID。

例:

```text
A-000
A-001
PORTRAIT-003
```

Display IDは後から変更可能。

---

# 9. ID NORMALIZATION

Display IDはUser単位で重複禁止。

重複判定用に`display_id_normalized`を作ってください。

Normalize:

- trim
- Unicode NFKC
- case-fold
- 全角/半角差を可能な範囲で吸収

例:

```text
A-001
a-001
Ａ－００１
```

が意図せず3つ作られないこと。

表示文字列そのものはユーザー入力を保持して構いません。

---

# 10. SERIES AUTO ID

Series IDが未入力なら以下の順番で提案。

```text
A-000
B-000
...
Z-000
AA-000
AB-000
...
```

A-Zのbase-26風Increment関数を作成し、Unit Testしてください。

ユーザーは任意IDを入力可能。

---

# 11. CHILD AUTO ID

Root:

```text
A-000
```

なら:

```text
A-001
A-002
A-003
```

Root:

```text
PORTRAIT-000
```

なら:

```text
PORTRAIT-001
PORTRAIT-002
```

Root:

```text
CAT
```

なら:

```text
CAT-001
CAT-002
```

Root:

```text
PROJECT-12
```

なら:

```text
PROJECT-12-001
PROJECT-12-002
```

削除した番号は原則再利用しません。

`series.next_card_number`を持ってください。

自動提案は常にユーザーが編集可能。

---

# 12. TITLE RULE

`display_id`と`title`は別。

例:

```text
ID: A-005
Title: 雨を強くした版
```

Title未入力の場合は`Untitled`や`無題`を勝手に入れないでください。

UIではIDだけ表示。

---

# 13. INFORMATION ARCHITECTURE

Bottom Navigationは5つ。

```text
ホーム
ツリー
画像
検索
設定
```

英語内部名:

- HOME
- TREE
- IMAGES
- SEARCH
- SETTINGS

Fullscreen ViewerとLock ScreenではBottom Navigationを隠してよい。

TREEタブは最後に開いたSeries TREEへ戻ります。

一度もTREEを開いていない場合、簡潔なSeries選択画面を表示してください。

---

# 14. HOME SCREEN

HOMEはSeries Root Cardだけを表示。

例:

```text
┌──────────┐ ┌──────────┐
│          │ │          │
│  IMAGE   │ │  IMAGE   │
│          │ │          │
├──────────┤ ├──────────┤
│ A-000    │ │ B-000    │
│ 夜の街角 │ │ 雨の研究 │
└──────────┘ └──────────┘
```

表示:

- Root Cover Thumbnail
- Root Display ID
- Root Title（ある場合のみ）

表示しない:

- Prompt
- Memo
- Rating
- Tags
- AI Provider

HOMEは研究内容を読む画面ではなく、Seriesへ入る入口です。

---

# 15. HOME GRID

iPhoneでは原則2列程度。

画面幅に応じResponsive。

カードの画像は3:4予定。

Original比率の雰囲気が分かる表示を優先。

HOME自体は通常の縦Scrollを許可。

---

# 16. HOME MANUAL REORDER

Seriesカードを長押し → Dragで並び替え。

短いTouch MovementはScrollを優先。

推奨:

- long press delay: 300〜400ms
- movement tolerance: 約8px

並び替え結果は`series.sort_order`へ保存。

画面幅変更後も座標ではなくOrderを使ってGridを再配置。

---

# 17. CREATE SERIES

HOMEに`＋`。

親指で届きやすい位置を優先。

作成Form:

- ID
- Title
- Images
- Full Prompt
- Memo

画像は最低1枚。

Root Cardも複数画像可。

ID空欄ならAuto Suggest。

SeriesとRoot Cardは一体として作成し、RootなしSeriesを通常状態に残さない。

---

# 18. ROOT CARD

SeriesはContainer。

Root Cardは最初の生成実験。

```text
Series A
└─ A-000 (Root Card)
```

Root Cardも通常Cardと同じく以下を持てます。

- Images
- Full Prompt
- Memo
- Rating
- Tags
- AI Provider
- Model
- Metadata

SeriesテーブルとRoot Cardへ画像・Promptを二重保存しないでください。

---

# 19. ROOT DETAIL

HOME → Root Card Tap。

Header:

```text
← 戻る                         ツリーへ →
```

その下:

- ID
- Title
- Image Carousel
- Prompt
- Memo
- Rating
- Tags
- AI
- Model
- Advanced Metadata

左上Back:

HOMEへ戻る。

HOME Scroll位置を維持。

右上Tree:

そのSeries TREEを開き、Root CardをFocus。

---

# 20. CHILD CARD DETAIL

基本はRoot Detailと同じ。

Header:

```text
← 戻る                         ツリーへ →
```

表示:

- Display ID
- Title
- Image Carousel
- Rating
- Full Prompt
- Delta Prompt
- Memo
- AI Provider
- Model
- Tags
- Advanced Metadata
- Parent information
- Reference relations

---

# 21. BACK SEMANTICS

「戻る」は必ず直前の文脈へ戻す。

## TREE origin

```text
TREE
→ A-017 Detail
→ Back
```

戻る先:

- 同じTREE
- 同じPan位置
- 同じZoom
- 可能なら同じ選択状態

## IMAGES origin

```text
IMAGES
→ Viewer
→ Card Detail
→ Back
```

元GridのFilter、Sort、Scroll位置を維持。

## SEARCH origin

元Query、Result、Scroll位置を維持。

## Direct Link

Browser historyがない直接Detail URLの場合、Back fallbackはHOME。

---

# 22. OVERLAY ROUTING STRATEGY

TREEやIMAGESからDetailを開くたびに背後PageをUnmountしないでください。

推奨:

React Routerのbackground location / modal route / overlay route相当。

例:

```text
TREE remains mounted
↓
Detail full-screen overlay
↓
Close
↓
TREE viewport remains intact
```

Direct URL access時はStandalone Detailとして描画可能。

---

# 23. PROMPT UI

Full Promptは長文前提。

Default:

3〜5行Preview。

```text
続きを見る
```

で展開。

Full PromptにCopyボタン。

成功Toast:

```text
コピーしました
```

Delta PromptにもCopyを付けてよい。

PromptやMemoはHTMLとしてRenderしない。

---

# 24. FULL PROMPT / DELTA PROMPT

Card:

- `prompt_full`
- `prompt_delta`

`prompt_full`:

その生成時に実際に使用した最終Prompt全文。

`prompt_delta`:

Primary Parentから追加/変更した部分。

Deltaは空可。

研究上両方持てることが重要。

---

# 25. CARD = GENERATION EXPERIMENT

最重要。

1 Card = 1 generation experiment。

例:

同一Promptから5枚生成:

```text
A-005
├─ Image 1
├─ Image 2
├─ Image 3
├─ Image 4
└─ Image 5
```

TREE:

Card 1個。

DETAIL:

5画像Carousel。

IMAGES:

5セル。

このルールを絶対に崩さないでください。

---

# 26. IMAGES PER CARD

1〜20枚程度を快適に扱えるUI。

DBで5枚固定しない。

Hard limit 20枚にも不要。

将来さらに多くてもSchema変更不要。

---

# 27. COVER IMAGE

複数画像登録時:

最初の画像を自動Cover。

ユーザーは後から任意画像を`代表画像に設定`可能。

Coverは:

- HOME
- TREE

で使用。

Card last imageを削除して0枚Cardを作らない。

Cover削除時は残るImageの最若`sort_order`を自動Cover。

---

# 28. IMAGE ORDER

Card内Image順は変更可能。

Thumbnail長押しDragでReorder。

`card_images.sort_order`へ保存。

---

# 29. IMAGE FAVORITE / CARD RATING

Favorite:

**Image単位**。

Rating:

**Card単位**。

Rating:

- NULL
- 1
- 2
- 3
- 4
- 5

例:

A-005全体 = ★★★★☆

Image 2のみFavorite。

---

# 30. IMAGE ADD / REPLACE / DELETE

Card Detailから:

- 画像追加
- 画像差し替え
- 画像削除
- 代表に設定
- Favorite toggle

可能。

Image差し替え時:

Card ID / Prompt / Relations / Canvas Position等は維持。

Thumbnail再生成。

---

# 31. IMAGE INPUT SOURCES

対応:

- iPhone Photos
- iPhone Files
- PC file picker

`multiple`対応。

Clipboard pasteはMVP不要。

---

# 32. IMAGE FORMATS

対応:

- JPEG
- PNG
- WebP
- HEIC
- HEIF

Originalは原本をそのまま保存。

ThumbnailはWebP等へ変換可。

SVGはMVP対象外。

---

# 33. HEIC / HEIF

iPhone由来HEICを想定。

OriginalはHEICのままR2。

Thumbnail生成:

1. Browser decode可能なら`createImageBitmap`/Canvas
2. 不可ならHEIC decoderを必要時dynamic import
3. Thumbnail失敗でもOriginalを勝手に削除しない
4. Placeholder + Retryを提供

---

# 34. ORIGINAL / THUMBNAIL POLICY

Original:

一切意図的に品質低下させない。

Thumbnail:

- long edge 約512〜768px
- WebP quality 0.8前後を目安
- original aspect ratio保持でよい
- Image GridのSquare表示はCSS crop

HOME / TREE / IMAGES一覧はThumbnail。

FullscreenはOriginal。

DetailはThumbnail即表示後にOriginalを必要時Load。

---

# 35. IMAGE UPLOAD SIZE

`MAX_IMAGE_BYTES`を設定値として用意。

初期例:

50MB。

コードに散在させない。

---

# 36. MULTI-UPLOAD FLOW

複数画像選択時:

1. Validate
2. Thumbnail generation
3. Original upload
4. Thumbnail upload
5. DB finalize

同時upload数を約3程度へ制限可。

5枚選択で巨大uploadを5本無制限同時実行しない。

Progress:

```text
3 / 5
```

などを表示。

---

# 37. PARTIAL UPLOAD FAILURE

5枚中4成功、1失敗の場合:

成功4枚を勝手に破棄しない。

表示:

```text
1枚のアップロードに失敗しました
```

Actions:

- 再試行
- 失敗画像を除外して保存

Background upload継続をiOSで保証しない。

中断時はPending/Draftを検出可能に。

---

# 38. FULLSCREEN VIEWER

画像Tap → Fullscreen。

黒背景。

機能:

- full image
- pinch zoom
- double tap zoom
- pan
- horizontal swipe
- image count
- Favorite
- Prompt copy
- Card Detail
- ツリーで見る
- 写真に保存 / share sheet
- Close

PhotoSwipe等を優先。

Zoom > 1ではPanを優先し、画像を左右へPanしただけで次画像へ誤移動しない。

---

# 39. SAVE IMAGE ON IPHONE

iOS/PWA制約を考慮。

可能ならWeb Share APIのFiles共有を優先し、共有シート経由で保存可能に。

非対応時:

download fallback。

UIは技術用語を見せず、

```text
写真に保存
```

等にする。

---

# 40. TREE OVERVIEW

各Seriesは独立Infinite Canvas。

例:

```text
           A-000
          /     \
      A-001     A-002
        |
      A-003

                     A-004
```

A-004は独立Cardでもよい。

A TreeとB Treeを混在させない。

---

# 41. TREE PAGE SCROLL

絶対条件。

TREE画面ではBrowser/Pageそのものを1pxもScrollさせない。

CanvasだけPan。

推奨CSS:

```css
height: 100dvh;
overflow: hidden;
overscroll-behavior: none;
touch-action: none; /* 必要範囲のみ慎重に */
```

iPhone Safari/PWAのrubber-bandによる誤Scrollを抑制。

ただしReact Flow pinch/panを壊さない。

Playwright + 実機で検証。

---

# 42. TREE SAFE AREA

以下を考慮:

- Dynamic Island
- notch
- home indicator

CSS:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
```

Toolbar / FAB / BottomNavがhome indicatorに被らない。

---

# 43. TREE TOUCH MODEL

Touch:

- Canvas空白 1-finger drag = Pan
- 2-finger pinch = Zoom
- Card tap = Detail
- Card long press + drag = Node Move
- Edge tap = Edge controls

Cardを通常dragですぐ動かさない。

理由:

Canvasを動かしたいときの誤Node移動を防ぐ。

Long press:

約300〜450ms目安。

Long press成立前に指が一定以上移動したらCancel。

---

# 44. TREE NODE UI

通常Zoom:

```text
┌──────────┐
│          │
│  IMAGE   │
│          │
├──────────┤
│ A-017    │
└──────────┘
```

表示:

- Cover Thumbnail
- Display ID
- 複数画像なら小badge

表示しない:

- Prompt
- Memo
- AI
- Rating
- 長いTitle

複数Image:

```text
5枚
```

Badge。

---

# 45. TREE LEVEL OF DETAIL

Zoom out時に情報量を減らす。

例:

- zoom > 0.55 → Image + ID
- zoom <= 0.55 → Image only

閾値は実機調整。

巨大Treeの俯瞰をしやすくする。

---

# 46. ROOT POSITION

Series作成時:

Root Card `x=0, y=0` 等。

Rootも後から自由移動可。

---

# 47. NEW CHILD AUTO POSITION

Primary Parentから派生作成時:

新CardをParent下方付近へ自動配置。

Sibling overlapを避ける。

完全自動Tree Layoutでユーザー配置を上書きしない。

初期位置だけ支援。

---

# 48. INDEPENDENT CARD POSITION

ParentなしCard:

現在Viewport中心付近。

既存Nodeと重なる場合は少しoffset。

---

# 49. CREATE CARD

TREE `＋`。

Basic:

- Images
- ID
- Title
- Full Prompt
- Delta Prompt
- Primary Parent

Advanced:

- Additional Parents
- Memo
- AI Provider
- Model
- Tags
- Rating
- Metadata

1画面へ全項目を密集させない。

Basicを優先し、AdvancedはCollapse。

---

# 50. DERIVE FROM CARD

Detailに:

```text
この画像から派生
```

を用意。

Tap:

Create Card。

Auto:

- Primary Parent = current card
- ID = next suggestion
- initial node position = current card近傍

---

# 51. MULTI-PARENT

Cardは複数Parent可。

例:

```text
A-003 ─┐
       ├→ A-010
A-007 ─┘
```

Primary Parent最大1。

Additional Parents複数。

---

# 52. PARENT CYCLE

Parent EdgeはCycle禁止。

例:

A-001 → A-002 → A-003 → A-001

を拒否。

Server側でcycle detection。

Reference Edgeはcycle可。

---

# 53. REFERENCE EDGE

親子ではない関連接続。

内部:

```text
kind = "reference"
```

Parent:

```text
kind = "parent"
```

ユーザーが比較・参考したいだけの線を作れる。

---

# 54. EDGE COLORS

Edgeは色を変更可能。

Preset例:

- blue
- green
- orange
- red
- purple
- gray

色の意味はアプリが決めない。

Edge labelはMVP不要。

Parentは方向が分かる小Arrowを使ってよい。

---

# 55. MANUAL CONNECTION

二方式を提供。

## A: child creation

Parent選択時に自動edge。

## B: manual

Card select時だけ大きなTouch handle。

または:

```text
接続
→ 接続先カードをタップ
→ 親子 / 参考を選択
```

の補助方式。

iPhoneで小さなdefault handleだけに依存しない。

---

# 56. TREE CONTROLS

画面右下等:

- Rootへ
- 全体表示
- ＋

Rootへ:

Root Card focus。

全体表示:

Fit View。

BottomNav / Safe Areaに被らない。

---

# 57. TREE VIEWPORT PERSISTENCE

Seriesごとに:

- viewport_x
- viewport_y
- viewport_zoom

を保存。

Canvas操作中に毎pointermoveでDB writeしない。

Debounce約500〜1000ms。

離脱時にもflush。

---

# 58. EXACT BACK RESTORE

Detailを開く直前のViewportをLocal Session Stateへ保存。

Back:

Server保存値ではなくLocal Snapshotを優先。

これによりDetailからBackした際に視点を見失わない。

---

# 59. CROSS-DEVICE VIEWPORT

D1へ保存したViewportは別端末初期位置として使用。

同一セッションBackはLocal Snapshot優先。

---

# 60. UNDO / REDO

TREEで:

- Undo
- Redo

対象:

- Node move
- Card create
- Card delete
- Edge create
- Edge delete
- Edge color
- Parent change

直近20〜50 operations程度。

Undo StackはSessionだけでよい。

---

# 61. CARD DELETE

確認Dialog。

30日Trash UI不要。

削除直後約10秒:

```text
A-017を削除しました   元に戻す
```

Soft Delete → Grace → Physical cleanup。

Root Card単独削除不可。Root削除はSeries削除。

---

# 62. SERIES DELETE

Series削除時:

- Cards
- Images
- Edges
- Relations

対象。

確認DialogにCard数/画像数を表示してよい。

例:

```text
Aシリーズを削除しますか？
カード18件、画像42枚が削除されます。
```

---

# 63. DUPLICATE CARD

Card単体複製。

複製:

- Images
- Prompt
- Delta
- Memo
- AI
- Model
- Tags
- Rating

新Display ID。

子孫Branchは複製しない。

Relationsを勝手に完全copyしない。

必要なら同Primary Parentを初期候補にする程度。

---

# 64. MOVE CARD BETWEEN SERIES

Child Cardは別Seriesへ移動可。

例:

```text
A-017 → B-024
```

Destination Seriesの次IDを提案。

ユーザー編集可。

保持:

- Images
- Prompt
- Delta
- Memo
- Rating
- Tags
- Metadata

解除:

旧SeriesとのEdge。

Rootは移動不可。

子孫は自動移動しない。

---

# 65. ROOT ID RENAME

例:

```text
A-000 → PORTRAIT-000
```

Dialog:

- Root IDだけ変更
- 自動採番Child IDも変更

Childも変更を選んだ場合:

```text
A-001 → PORTRAIT-001
A-002 → PORTRAIT-002
```

ただし手動Custom ID（例`SUNSET`）は勝手に変更しない。

---

# 66. AI PROVIDER / MODEL

`ai_provider` default:

```text
ChatGPT
```

候補例:

- ChatGPT
- Gemini
- Midjourney
- Stable Diffusion
- Adobe Firefly
- Other

自由入力可。

Modelは任意入力。

Default空。

---

# 67. ADVANCED METADATA

Default collapse。

項目例:

- Seed
- Aspect Ratio
- Generation Date
- Sampler
- Steps
- CFG
- arbitrary key/value

DBは`metadata_json`等でもよい。

App registration dateとGeneration Dateを混同しない。

---

# 68. TAGS

Cardへ複数Tag。

既存Tag suggestions。

Tag duplicate normalize。

例:

- 人物
- 風景
- 構図固定
- 夜景
- フォトリアル

---

# 69. IMAGES TAB

iPhone Photos風。

画像だけを高密度Grid。

Typical iPhone:

約3列。

Large device:

4列以上可。

Grid cellはSquare crop。

Originalは3:4のまま。

TextをGrid上に大量表示しない。

---

# 70. IMAGES MULTI-CARD RULE

A-005に5画像:

Images Gridに5セル。

全て同じ`card_id`。

Grid cellからViewerへ。

---

# 71. IMAGES FILTER

Series chips:

```text
すべて | A | B | C | PORTRAIT | ...
```

横Scroll。

内部は`series_id`で判定。

Display ID解析だけに依存しない。

Type filter:

- すべて
- 大項目
- 派生
- お気に入り

大項目:

Root Card Images全部。

派生:

Root以外。

Favorite:

`image.is_favorite=true`。

---

# 72. IMAGES SORT

- 新しい順
- 古い順
- シリーズ順

Default:

新しい順。

---

# 73. IMAGES VIRTUALIZATION

10,000 Images。

全DOM生成禁止。

Cursor Pagination + Virtualized Grid。

例:

約100〜150 records/page程度。

Grid viewport周辺だけThumbnail load。

---

# 74. IMAGE VIEWER ADJACENT PREFETCH

Fullscreen:

現在Image + 前後1枚程度をprefetch。

20枚全部Original preloadしない。

---

# 75. IMAGE MULTI SELECT

Selection Mode。

複数画像:

- delete
- export
- series move

ただしSeries MoveはCard単位。

選択がCard内全画像を含まない場合:

```text
シリーズ移動にはカード内のすべての画像を選択してください
```

と通知。

---

# 76. IMAGE → TREE

Viewer:

```text
ツリーで見る
```

Tap:

1. 所属Series TREE
2. Cardへauto pan
3. reasonable zoom
4. Card center focus

Display ID変更に影響されないようUUIDでNavigation。

---

# 77. SEARCH

対象:

- Display ID
- Title
- Full Prompt
- Delta Prompt
- Memo
- AI Provider
- Model
- Tags

Input debounce約200〜400ms。

ResultはCard単位。

Result display:

- Thumbnail
- ID
- Title
- match snippet

Prompt全文はResult一覧へ出さない。

---

# 78. SEARCH PERFORMANCE

10,000 Images / 数千Cardsを想定。

D1でFTSが安定利用可能ならFTSを検討。

そうでなければIndex + LIKE等。

毎検索で無条件Full Table Scanを避ける。

Cursor Pagination。

---

# 79. SEARCH BACK STATE

Result → Detail → Back:

- query
- filters
- result scroll

を維持。

---

# 80. APP LOCK MODEL

Lockは2層概念。

1. Owner authentication
2. 4-digit App PIN

4桁PINだけをRemote Owner Authに使わない。

---

# 81. OWNER

MVP Owner 1人。

ただし複数端末から同一Cloud Data利用。

不要:

- family accounts
- role management
- multi-tenant UI

---

# 82. FIRST SETUP

初回のみ:

- Master Password
- 4-digit PIN
- PIN confirmation

Productionで未設定状態を長期間誰でもsetupできないよう、可能ならDeployment Setup Tokenを環境Secretで要求。

---

# 83. MASTER PASSWORD

新Device本人認証用。

十分な長さを要求。

例:

12 chars以上推奨。

Plaintext保存禁止。

PBKDF2-HMAC-SHA256等、Cloudflareで安全に扱えるKDF + random salt。

単純SHA256(password)は禁止。

---

# 84. PIN

4桁。

Plaintext保存禁止。

salted verifier。

連続誤りでBackoff。

例:

5回失敗後一時lock。

Server APIにもRate Limit。

---

# 85. SESSION

Login success:

Secure Session。

Cookie:

- HttpOnly
- Secure
- reasonable SameSite

Session tokenはrandom。

DBにはtoken hash。

---

# 86. APP AUTO LOCK

最後の意味のあるユーザー操作から5分。

Backgroundが一定時間続いた場合もLock。

API pollingだけでtimer延長しない。

User activity heartbeatはthrottle。

---

# 87. PRIVACY OVERLAY

`visibilitychange` / `pagehide`等でBackground遷移を検知。

App SwitcherにSensitive Image/Promptが残りにくいよう即Privacy Overlay。

Lock状態ではSensitive UIを背面に描画し続けない。

---

# 88. PASSKEY / FACE ID

無料で安定実装可能ならWebAuthn / Passkey。

iPhone Platform AuthenticatorでFace ID相当体験。

ただし:

- 必須ではない
- 有料認証サービスを導入しない
- 非対応/失敗時はPIN fallback

UIは端末により:

```text
端末認証で解除
```

等。

---

# 89. APP FIRST PAINT

Sensitive Homeを一瞬描画してからLock overlayを載せる実装は禁止。

First paint:

- loading
- lock

のみ。

Unlock確認後にSensitive pageをMount。

---

# 90. OFFLINE

基本Online。

Offline:

- App shell
- 最近見たCard
- 最近見たThumbnail

閲覧。

編集は原則禁止。

表示:

```text
オフラインです。閲覧のみ利用できます。
```

複雑なOffline write queueはMVP不要。

Source of Truth:

D1 + R2。

IndexedDBはcache。

---

# 91. SETTINGS

iOS Settings風Group List。

項目:

- PIN変更
- 端末認証設定
- Master Password変更（可能なら）
- Logout
- Logout all
- Default AI Provider
- Storage Usage
- Export
- App Version
- About

ThemeはSystem追従。

---

# 92. DESIGN SYSTEM

iOS純正に近い。

- light/dark
- system font
- large hit targets
- images first
- restrained separators
- sensible whitespace
- transparent/blur bars where appropriate
- no desktop sidebar
- no hover dependency

Tap area目標:

最低44×44 CSS px。

---

# 93. DARK MODE

`prefers-color-scheme`追従。

Lock/Home/Tree/Detail/Images/Search/Settings/Dialog/Toast全て検証。

---

# 94. ACCESSIBILITY

最低限:

- semantic buttons
- aria-label
- focus-visible
- keyboard support PC
- contrast
- reduced motion
- semantic heading
- image alt
- no color-only critical state

---

# 95. MOBILE KEYBOARD

Prompt長文入力時:

KeyboardでSaveが完全に隠れない。

Sticky action / VisualViewport等を合理的に利用。

Textarea:

- auto-grow
- reasonable max-height
- cursor visibility

---

# 96. ROUTES

例:

```text
/setup
/login
/lock
/home
/series/:seriesUuid/root
/series/:seriesUuid/tree
/cards/:cardUuid
/images
/images/:imageUuid
/search
/settings
```

Display IDをURL primaryに使わない。

---

# 97. LOCAL UI STATE

保持:

- Home scroll
- Images scroll
- Image filters
- Image sort
- Search query
- Search scroll
- Tree viewport
- Last tree series
- Overlay origin
- selection
- undo stack

Zustand / sessionStorage / router state等を適切に使う。

Server dataを不要に全量二重保持しない。

---

# 98. DATABASE TABLES

最低:

- users
- auth_sessions
- webauthn_credentials
- app_settings
- series
- cards
- card_images
- edges
- tags
- card_tags

必要なら:

- upload_sessions
- cleanup_jobs

追加可。

---

# 99. USERS SCHEMA

概念:

```sql
users (
  id TEXT PRIMARY KEY,
  master_password_hash TEXT NOT NULL,
  master_password_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

---

# 100. AUTH_SESSIONS SCHEMA

```sql
auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  unlock_expires_at INTEGER,
  revoked_at INTEGER
)
```

Indexesを適切に。

---

# 101. SERIES SCHEMA

```sql
series (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  root_card_id TEXT,
  sort_order INTEGER NOT NULL,
  next_card_number INTEGER NOT NULL DEFAULT 1,

  viewport_x REAL NOT NULL DEFAULT 0,
  viewport_y REAL NOT NULL DEFAULT 0,
  viewport_zoom REAL NOT NULL DEFAULT 1,

  version INTEGER NOT NULL DEFAULT 1,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)
```

---

# 102. CARDS SCHEMA

```sql
cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  series_id TEXT NOT NULL,

  display_id TEXT NOT NULL,
  display_id_normalized TEXT NOT NULL,

  title TEXT,

  prompt_full TEXT,
  prompt_delta TEXT,
  memo TEXT,

  ai_provider TEXT NOT NULL DEFAULT 'ChatGPT',
  model TEXT,

  rating INTEGER,
  metadata_json TEXT,

  cover_image_id TEXT,

  canvas_x REAL NOT NULL DEFAULT 0,
  canvas_y REAL NOT NULL DEFAULT 0,

  version INTEGER NOT NULL DEFAULT 1,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)
```

Rating 1〜5 or NULL。

---

# 103. CARD_IMAGES SCHEMA

```sql
card_images (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,

  original_key TEXT NOT NULL,
  thumbnail_key TEXT,

  original_filename TEXT,

  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  width INTEGER,
  height INTEGER,

  sort_order INTEGER NOT NULL,

  is_favorite INTEGER NOT NULL DEFAULT 0,

  upload_status TEXT NOT NULL DEFAULT 'pending',

  version INTEGER NOT NULL DEFAULT 1,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)
```

`upload_status`:

- pending
- uploading
- ready
- failed

---

# 104. EDGES SCHEMA

```sql
edges (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,

  source_card_id TEXT NOT NULL,
  target_card_id TEXT NOT NULL,

  kind TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,

  version INTEGER NOT NULL DEFAULT 1,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
)
```

`kind`:

- parent
- reference

Active ParentでChildごとPrimary最大1。

---

# 105. TAGS

```sql
tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

`user_id + name_normalized` unique。

```sql
card_tags (
  card_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(card_id, tag_id)
)
```

---

# 106. DB INDEXES

最低検討:

- cards(user_id, display_id_normalized)
- cards(series_id, deleted_at)
- cards(created_at)
- card_images(card_id, sort_order)
- card_images(is_favorite, deleted_at)
- edges(series_id, deleted_at)
- tags(user_id, name_normalized)
- series(user_id, sort_order)

Partial unique indexが使える場合活用。

---

# 107. MIGRATIONS

Runtime起動時に勝手にSchema変更しない。

`migrations/`

例:

```text
0001_initial.sql
0002_indexes.sql
0003_search.sql
```

READMEにmigration手順。

---

# 108. R2 KEY DESIGN

Display IDやTitle変更でObject pathを変更しない。

例:

```text
users/{userUuid}/cards/{cardUuid}/images/{imageUuid}/original.ext
users/{userUuid}/cards/{cardUuid}/images/{imageUuid}/thumb.webp
```

BucketはPrivate。

---

# 109. IMAGE DELIVERY

Public permanent URLは禁止。

Authenticated Worker streamまたは短期Signed access等、単純かつ安全な方法。

Thumbnailも認証なしPermanent Publicにしない。

---

# 110. API GENERAL RULE

Prefix:

```text
/api
```

JSON:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "DUPLICATE_DISPLAY_ID",
    "message": "このIDはすでに使用されています"
  }
}
```

Client inputはZod等でValidate。

Prepared statements。

---

# 111. AUTH API

最低:

```text
GET  /api/auth/status
POST /api/auth/setup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/logout-all
POST /api/auth/unlock
POST /api/auth/lock
POST /api/auth/activity
POST /api/auth/change-pin
```

Passkey:

```text
POST /api/auth/passkey/register/options
POST /api/auth/passkey/register/verify
POST /api/auth/passkey/login/options
POST /api/auth/passkey/login/verify
```

---

# 112. SERIES API

```text
GET    /api/series
POST   /api/series
GET    /api/series/:seriesId
PATCH  /api/series/:seriesId
DELETE /api/series/:seriesId

POST   /api/series/reorder
GET    /api/series/:seriesId/tree
PATCH  /api/series/:seriesId/viewport
PATCH  /api/series/:seriesId/card-positions
```

Create SeriesはSeries + Root CardをAtomicに扱う。

---

# 113. CARD API

```text
GET    /api/cards/:cardId
POST   /api/series/:seriesId/cards
PATCH  /api/cards/:cardId
DELETE /api/cards/:cardId

POST   /api/cards/:cardId/duplicate
POST   /api/cards/:cardId/move
POST   /api/cards/:cardId/restore
```

---

# 114. IMAGE API

必要に応じ:

```text
POST   /api/cards/:cardId/images/init
PUT    /api/images/:imageId/original
PUT    /api/images/:imageId/thumbnail
POST   /api/images/:imageId/finalize

PATCH  /api/images/:imageId
DELETE /api/images/:imageId

GET    /api/images
GET    /api/images/:imageId/original
GET    /api/images/:imageId/thumbnail

POST   /api/cards/:cardId/images/reorder
POST   /api/cards/:cardId/cover
```

Endpointを統合しても挙動は維持。

---

# 115. EDGE API

```text
POST   /api/edges
PATCH  /api/edges/:edgeId
DELETE /api/edges/:edgeId
```

Server:

- same series validation
- cycle validation
- primary validation

---

# 116. SEARCH / IMAGES API

```text
GET /api/search?q=...
GET /api/images?cursor=...&seriesId=...&type=...&favorite=...&sort=...
```

Cursor pagination。

Offset後半遅延を避ける。

---

# 117. API PAYLOAD MINIMIZATION

HOME:

必要なのはRoot thumbnail / ID / title / count程度。

TREE:

Node thumbnail / ID / image count / x / y / edges。

TREE APIで全Promptを返さない。

IMAGES:

thumbnail / image ID / card ID / series / favorite / date程度。

Full PromptはDetail API。

---

# 118. OPTIMISTIC CONCURRENCY

Multi-device。

`version`列。

Write request:

`expectedVersion`。

Mismatch:

HTTP 409。

Prompt本文等をSilent overwriteしない。

UI:

```text
別の端末で更新されています。最新内容を読み込みました。
```

必要ならLocal editを保持して再適用。

Card position / viewportはlast-write-winsでも可。

---

# 119. TREE POSITION SAVE

Node drag中はLocalのみ。

Drag EndでServer。

複数位置をBatch更新可。

ViewportはDebounce。

---

# 120. SEARCH STATE / DATA SYNC

App resume / tab focus時:

軽いrevalidation。

ただしTREEを開くたびにFull graphを無条件再FetchしてViewportを初期化しない。

Data syncの目的は最新化であり、UI文脈破壊ではない。

---

# 121. MULTI-DEVICE DATA SYNC

Source of Truth:

- D1 metadata
- R2 image originals/thumbs

IndexedDB:

cache。

Page focus時:

- stale metadata revalidate
- currently editing itemはversion conflict配慮

Push realtime syncはMVP不要。

---

# 122. DELETION / CLEANUP

UI:

確認 + short Undo。

内部:

soft delete grace。

R2物理削除は即座にしない。

Scheduled Worker等で:

- deleted images
- orphan uploads
- pending > 24h

cleanup。

---

# 123. IMAGE UPLOAD CONSISTENCY

Upload途中:

DB `pending`。

readyになるまでは通常TREEへ出さない。

Root upload全失敗:

空SeriesをHOMEへ出さない。

---

# 124. EXPORT

SETTINGS:

```text
データを書き出す
```

目的:

人間が保管できるExport。

完全Restoreではない。

含む:

- Original Images
- prompts.csv
- prompts.json

含めなくてよい:

- Canvas coordinates
- Viewport
- Edges
- Undo stack
- Auth
- Settings

---

# 125. EXPORT CONTENT

CSV/JSON:

- Series
- Card Display ID
- Title
- Full Prompt
- Delta Prompt
- Memo
- AI Provider
- Model
- Rating
- Tags
- Image filenames
- created_at

UTF-8。

Japanese文字化けしない。

---

# 126. EXPORT STRUCTURE

例:

```text
PromptTree_Export_2026-09-23/
  prompts.csv
  prompts.json

  images/
    A-000/
      A-000/
        image1.png
      A-001/
        image1.png
        image2.png
```

Filename collision回避。

---

# 127. LARGE EXPORT

10,000 Originalsを一度にBrowser Memoryへ載せない。

Streaming / chunks。

必要なら:

```text
part01.zip
part02.zip
```

Export前:

- image count
- estimated size

表示。

JPEG/PNG/HEIC等は既に圧縮されているためZIP再圧縮へCPUを無駄に使わなくてよい。

---

# 128. PWA

Manifest:

- APP_NAME
- short_name
- start_url
- display: standalone
- icons
- background_color
- theme_color

Apple touch icon。

Safari chromeを出さないstandalone体験。

---

# 129. SERVICE WORKER

Cache:

- app shell
- safe static assets

Sensitive APIを雑にpublic cacheしない。

Recent Thumbnail cacheは可能。

Originalを無制限cacheしない。

PWA update:

```text
新しいバージョンがあります
```

Update action。

編集中Formがあるとき強制Reloadしない。

---

# 130. CACHE / STORAGE LIMIT

Thumbnail cacheに上限。

LRU相当。

端末Storageを無限に消費しない。

Object URLはViewer close時に`revokeObjectURL`。

---

# 131. SECURITY HEADERS

適切に設定:

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Strict-Transport-Security

Same-origin中心。

不要な`Access-Control-Allow-Origin: *`禁止。

---

# 132. CSRF / XSS

Cookie auth:

- SameSite
- Origin check
- 必要なCSRF対策

Title/Prompt/MemoをHTMLとしてRenderしない。

`dangerouslySetInnerHTML`原則禁止。

Search highlightも安全なReact nodeとして生成。

---

# 133. LOGGING PRIVACY

ログへ以下を出さない:

- Prompt全文
- Password
- PIN
- Session token
- image binary
- private signed URL

Error codeやresource ID程度。

Third-party analyticsはMVP不要。

Search queryを外部Analyticsへ送らない。

---

# 134. ERROR CODES

例:

```text
UNAUTHORIZED
APP_LOCKED
INVALID_PIN
PIN_RATE_LIMITED
DUPLICATE_DISPLAY_ID
CARD_NOT_FOUND
SERIES_NOT_FOUND
EDGE_CYCLE
VERSION_CONFLICT
UPLOAD_TOO_LARGE
UNSUPPORTED_IMAGE_TYPE
UPLOAD_FAILED
OFFLINE_NOT_ALLOWED
```

User UIは技術Errorそのまま表示しない。

---

# 135. LOADING / EMPTY / ERROR

Loading:

Skeleton。

Empty Home:

```text
まだシリーズがありません
```

Empty Images:

```text
まだ画像がありません
```

Search none:

```text
一致するカードがありません
```

Network:

```text
通信できませんでした
```

Retry。

Infinite spinner禁止。

---

# 136. DRAFT / UNSAVED FORM

長いPrompt消失防止。

Card create/edit内容をsessionStorage/IndexedDBへ一時Draft可能。

UnsavedでBack:

```text
変更を破棄しますか？
```

必要な場合だけ。

---

# 137. PERFORMANCE

## IMAGES

10,000画像を全DOM表示しない。

Cursor + virtualization。

## TREE

Series数百Nodesでも操作可能。

Node component memoization。

Stable callbacks。

## Bundle

Route code splitting。

Heavy libs:

- tree
- viewer
- HEIC decoder

dynamic import。

---

# 138. COST CONTROL

Cloudflare低コスト優先。

禁止:

- HOMEで全Prompt取得
- TREEで全Prompt取得
- GridでOriginal画像取得
- 毎pointermove DB write
- 大量full-table scan

Thumbnail利用。

Index利用。

Pagination。

---

# 139. FILE / FOLDER STRUCTURE

推奨:

```text
src/
  app/
    App.tsx
    router.tsx
    config.ts

  components/
    common/
    layout/
    cards/
    images/
    tree/
    forms/
    auth/

  features/
    auth/
    series/
    cards/
    tree/
    images/
    search/
    settings/
    export/

  hooks/
  stores/

  services/
    api/
    auth/
    image/
    storage/

  types/
  i18n/
  styles/

functions/  or worker/
migrations/
public/
tests/
e2e/
```

既存Repoがあるなら自然に合わせる。

巨大App.tsx禁止。

---

# 140. TYPE SAFETY

TypeScript strict推奨。

`any`乱用禁止。

Shared types可。

最低:

- Series
- Card
- CardImage
- Edge
- Tag
- ApiResponse
- Viewport

---

# 141. API CLIENT

`fetch`をComponentへ散在させない。

Central api client。

統一処理:

- auth error
- lock error
- network
- conflict
- offline

---

# 142. APP LANGUAGE

MVP UI:

日本語。

Stringを大量にComponentへハードコードしない。

`src/i18n/ja.ts`等。

将来英語化可能。

---

# 143. NO DEAD ENDS

全画面で戻り先が明確。

Root Detail:

- Back = HOME
- Tree = Root Focus

Child Detail:

- Back = origin
- Tree = card focus

Viewer:

- Close = origin

Direct link:

- fallback HOME

---

# 144. BOTTOM NAV

Active state明確。

Detail overlay / Viewerでは隠してよい。

TREEはCanvas面積優先。

---

# 145. CARD DETAIL SCROLL

Detailは縦Scroll可。

Header sticky。

Left Back / Right Treeを常時アクセスしやすく。

TREEだけPage scroll禁止。

---

# 146. HOME SCROLL RESTORE

HOME → Root → Back:

元Scroll位置。

---

# 147. IMAGES SCROLL RESTORE

Images → Viewer → Close:

元Scroll位置。

Virtualized listでもrestore。

---

# 148. SEARCH SCROLL RESTORE

Search → Detail → Back:

Query + scroll restore。

---

# 149. TREE FOCUS

`ツリーで見る`時:

該当Cardが画面中央。

Card全体が見えるreasonable zoom。

過度にzoomしない。

Reduced Motionではinstant。

---

# 150. TREE ROTATION

Portrait ↔ Landscape。

Node coordinate不変。

Viewport centerをできる限り維持。

---

# 151. HOME LONG PRESS / TREE LONG PRESS

両者を混同しない。

HOME:

long press = reorder Series。

TREE:

long press node = move Card。

Short swipe = scroll/pan contextを優先。

---

# 152. EDGE INTERACTION

Edge tap:

small action sheet。

- color
- delete

Parent edgeならPrimary Parent変更への導線を付けてもよい。

---

# 153. PRIMARY PARENT DELETE

Primary Parent edgeを削除してAdditional Parentが残る場合:

残り1つをPrimaryへ昇格。

ParentがなくなればPrimaryなし。

---

# 154. SERIES MOVE RELATIONS

Cardを別Seriesへ移動するとCross-Series edgeは禁止。

旧Series Edge解除。

複数Cardをまとめて移動する将来/selection操作で、内部edgeが全て移動対象Card同士なら維持してよい。

MVPは安全性優先。

---

# 155. DATA CONSISTENCY INVARIANTS

Server側で保証:

1. cover_image_idは同Card所属Image
2. Active Edgeは同Series
3. Primary Parent最大1
4. Deleted CardへActive Edgeなし
5. Root CardはSeriesと一致
6. Cardは必ずSeries所属
7. Ready Cardは最低1 ready Image
8. display_id_normalized重複なし

---

# 156. TRANSACTIONS / BATCHES

Series + Root Card create。

Primary Parent switch。

Reorder。

関連WriteはD1 batch / transaction相当で整合を守る。

---

# 157. IMAGE DUPLICATION STRATEGY

Card duplicateでImageをどう扱うかは実装判断可。

ただし:

複製元Cardを削除しても複製Cardの画像が消えないこと。

単純さ優先ならR2 physical copy。

Reference countingは複雑化するため無理に採用しない。

---

# 158. SEARCH RESULT SECURITY

Prompt snippetをHTML injectionしない。

Text highlightは安全に分割render。

---

# 159. PWA OFFLINE LOCK

Cached DataがあってもUnlock前に表示しない。

Offline時のPIN verifierでUnlock。

PIN LockはE2EEではない。

アプリ内説明で暗号化と誤表現しない。

---

# 160. MULTI-DEVICE SESSION

新Device:

1. Master Password login
2. App PIN unlock
3. optional passkey registration

Logout all:

全session revoke。

---

# 161. AUTH RECOVERY

MVPでEmail reset不要。

READMEへOwner-operated recovery手順。

Master Passwordを忘れた場合の管理手順を記載。

---

# 162. SETTINGS STORAGE USAGE

表示可能:

- Card count
- Image count
- approximate stored bytes

Cloudflare請求額を断定しない。

---

# 163. VERSION

App versionをpackage/build metadataからSettingsへ表示。

---

# 164. README

必須章:

1. Product overview
2. Requirements
3. Install
4. Local development
5. D1 setup
6. Migrations
7. R2 setup
8. Cloudflare bindings
9. Secrets
10. First owner setup
11. Build
12. Deploy
13. GitHub/Cloudflare connection
14. iPhone PWA install
15. Testing
16. Export
17. Recovery
18. Known limitations

---

# 165. ENV / SECRETS

`.dev.vars.example`等。

Real secretは`.gitignore`。

Commit禁止:

- setup token
- passwords
- session secret
- cloud secrets

---

# 166. DEV DATA

Optional:

`npm run seed:dev`

Small sample:

- A-000
- A-001
- B-000

Production accidental seedを防ぐ。

巨大画像をrepoへcommitしない。

---

# 167. PACKAGE SCRIPTS

最低:

```text
dev
build
preview
typecheck
lint
test
test:e2e
```

必要なら:

```text
db:migrate
seed:dev
```

---

# 168. IMPLEMENTATION PHASE 0 — PRE-FLIGHT

最初に既存repoを調査。

確認:

- package.json
- lockfile
- current framework
- Cloudflare config
- Git status
- existing migrations
- current user code

既存成果物を破壊しない。

開始前に簡潔なImplementation Planを内部作成。

---

# 169. PHASE 1 — FOUNDATION

実装:

- React/TS/Vite
- Router
- PWA shell
- Cloudflare Worker/Functions
- D1
- R2 bindings
- migrations
- auth
- master password
- PIN
- lock shell
- privacy overlay

Gate:

- typecheck
- unit tests
- build

Passしてから次へ。

---

# 170. PHASE 2 — HOME / SERIES

実装:

- Series create
- Root Card
- HOME grid
- Cover thumbnail
- reorder
- Root detail
- back restore

Gate test。

---

# 171. PHASE 3 — CARD / IMAGES

実装:

- Card create/edit
- multi-image
- HEIC
- thumbnail
- upload progress
- partial retry
- carousel
- viewer
- favorite
- rating
- tags
- provider/model
- metadata
- derive

Gate test。

---

# 172. PHASE 4 — TREE

実装:

- React Flow
- pan
- pinch
- long press move
- node LOD
- independent node
- parent edges
- multiple parents
- primary parent
- reference edges
- edge color
- manual connect
- auto placement
- root/focus controls
- undo/redo
- viewport persistence
- exact back restore
- portrait/landscape

Gate test。

---

# 173. PHASE 5 — IMAGES

実装:

- photos-style grid
- cursor pagination
- virtualization
- filters
- sort
- favorite
- multi-select
- viewer
- tree focus
- scroll restore

Gate test。

---

# 174. PHASE 6 — SEARCH / EXPORT

Search:

- query
- index
- snippet
- pagination
- state restore

Export:

- CSV
- JSON
- originals
- large dataset handling
- progress

---

# 175. PHASE 7 — MOBILE UX HARDENING

実機iPhone中心:

- safe areas
- keyboard
- long press
- gesture conflicts
- tree no-page-scroll
- viewer zoom
- landscape tree
- PWA standalone
- dark mode
- background privacy
- offline cached read

---

# 176. PHASE 8 — FINAL QA / DEPLOY

- all tests
- production build
- migration check
- deployment config
- security check
- performance synthetic data
- README
- known limitations
- no secret commit

---

# 177. TEST STRATEGY

4層:

1. Unit
2. Integration/API
3. E2E
4. Physical iPhone manual validation

Playwrightだけで完成判定しない。

---

# 178. UNIT TEST — ID

必須:

- A-000 → A-001
- PORTRAIT-000 → PORTRAIT-001
- CAT → CAT-001
- Z → AA series increment
- deleted number no reuse
- normalization duplicate

---

# 179. UNIT TEST — CARD / IMAGE

- multi image
- cover change
- cover delete fallback
- image favorite
- card rating
- image reorder
- tags
- prompt/delta

---

# 180. UNIT TEST — EDGE

- parent add
- multi parent
- primary
- cycle reject
- reference cycle allow
- edge delete
- edge color

---

# 181. UNIT TEST — MOVE / RENAME

- A→B move
- auto new ID
- old relation cleanup
- root move reject
- root rename root-only
- root rename auto-children
- custom child ID preserved

---

# 182. UNIT TEST — AUTH

- correct master password
- wrong password
- correct PIN
- wrong PIN
- PIN rate limit
- auto lock
- session expiry
- logout all
- passkey fallback

---

# 183. E2E — SERIES CREATE

Mobile viewport:

1. unlock
2. HOME
3. +
4. create A-000
5. add image
6. add prompt
7. HOME card appears
8. Root detail
9. Back
10. Home scroll remains

---

# 184. E2E — MULTI IMAGE CARD

Create A-005 with 5 images.

Expected:

- TREE = 1 node
- Detail = 5 images
- IMAGES = 5 cells
- Cover = first initially
- Favorite one image only works

---

# 185. E2E — TREE

- Root
- Child1
- Child2
- independent card
- parent edge
- reference edge
- edge color
- node move
- canvas pan
- zoom
- fit view
- root view

---

# 186. E2E — EXACT BACK

1. Treeを大きくPan
2. Zoom 0.72
3. A-017をTap
4. Detail
5. Back

Expected:

- viewport same
- A-017 remains same screen position within acceptable render tolerance
- no tree reset

---

# 187. E2E — BODY SCROLL

TREE上で:

- up swipe
- down swipe
- diagonal
- pinch

Expected:

`document.documentElement.scrollTop` / `document.body.scrollTop` changes = 0。

Canvas viewportだけ変化。

---

# 188. E2E — IMAGES

Synthetic 1000+ records:

- scroll
- filter A
- favorite
- viewer
- close
- original scroll restored
- switch sort
- card focus

---

# 189. E2E — SEARCH

Unique word in Prompt。

Search。

Open card。

Back。

Expected:

- query preserved
- result scroll preserved

---

# 190. E2E — LOCK

- unlock
- navigate sensitive content
- simulate 5min timeout
- lock
- verify image/prompt not visible behind
- unlock
- return to previous tab safely

---

# 191. E2E — HOME REORDER

A B C → C A B。

Reload。

Expected C A B。

---

# 192. E2E — SERIES MOVE

A-005 → B。

Expected:

- suggested B-next ID
- data retained
- disappears from A tree
- appears in B
- old edges removed

---

# 193. E2E — ROTATION

TREE Portrait → Landscape → Portrait。

No node coordinate mutation.

No major context loss。

---

# 194. E2E — OFFLINE

Cache recent card。

Network off。

Unlock。

Recent card read。

Edit attempt blocked with read-only message。

---

# 195. PHYSICAL IPHONE CHECKLIST

実機確認:

- home screen install
- standalone mode
- safe area
- long press home reorder
- tree pan
- pinch zoom
- card move
- tree no body scroll
- detail back restore
- image swipe
- image zoom
- share/save
- keyboard prompt edit
- app background privacy
- 5min lock
- dark mode
- tree landscape
- HEIC import

---

# 196. CRITICAL ACCEPTANCE CRITERIA

以下の1つでも満たさなければ「完成」と報告しない。

1. TREEからDetail→BackでViewport保持
2. TREE body/page scroll = 0
3. Canvas pan
4. Pinch zoom
5. Card tap opens Detail
6. Card long-press drag moves node
7. A-005に5 images
8. TREEではA-005 1 node
9. IMAGESでは5 cells
10. Viewer swipe
11. Original uncompressed
12. Separate thumbnail
13. HOME grid
14. HOME long-press reorder
15. Root left Back
16. Root right Tree
17. Prompt collapsed preview
18. Prompt copy
19. Multi-parent
20. Primary Parent
21. Reference Edge
22. Edge color
23. Independent Card
24. Root/fit controls
25. 10k images not all DOM
26. PIN lock
27. sensitive UI hidden while locked
28. multi-device sync
29. PWA standalone
30. dark mode
31. safe area
32. search
33. image filters
34. favorite
35. series move
36. duplicate
37. delete confirm
38. undo
39. export
40. Cloudflare production build/deploy config

---

# 197. TOUCH ACCEPTANCE

iPhoneで:

- short tap = detail
- short finger movement does not unexpectedly move card
- long press = move
- empty canvas drag = pan
- pinch = zoom
- connection target is large enough
- no hover-only control

---

# 198. PERFORMANCE ACCEPTANCE

Images 10,000 synthetic records:

- first screen does not wait for all 10k
- DOM does not contain 10k image tiles
- scrolling remains usable

Tree:

数百Nodes synthetic。

Pan/zoom usable。

HOME:

all prompt text not fetched。

---

# 199. SECURITY ACCEPTANCE

- no plaintext password
- no plaintext PIN
- no public permanent R2
- auth on sensitive API
- app locked state rejected/hidden
- HttpOnly session
- no prompt logging
- no secrets in repository
- no unsafe HTML prompt rendering

---

# 200. UPLOAD FAILURE ACCEPTANCE

5 images upload。

1 fail。

Expected:

- four success not silently lost
- retry button
- remove-failed-and-save option
- no corrupt ready card

---

# 201. CODING QUALITY

- TypeScript strict
- no pervasive `any`
- no giant god component
- no unhandled promise rejection
- no console error left unexplained
- ESLint pass
- typecheck pass
- tests pass
- production build pass

---

# 202. TODO POLICY

MVP必須機能にTODO/FIXMEを残して完成扱いにしない。

将来ScopeにのみTODO可。

---

# 203. COMMENTS

複雑箇所には簡潔なコメント:

- iOS gesture arbitration
- exact viewport restore
- cycle detection
- auth
- image upload finalize
- cleanup

自明なコードへ大量コメント不要。

---

# 204. DO NOT DO THESE

禁止:

- Notion-like database table as main UI
- desktop sidebar main navigation
- full prompt on tree nodes
- original images in grid
- 1 image = 1 card assumption
- splitting 5 outputs into 5 cards automatically
- public R2 bucket
- AI generation API in MVP
- paid Face ID vendor
- 30-day trash UI
- complete restore UI
- branch duplication
- forced automatic canvas layout
- home infinite canvas
- hover-only actions
- silent prompt conflict overwrite
- sensitive first paint before lock check

---

# 205. IMPLEMENTATION DECISION FREEDOM

以下は本仕様を満たす限り変更可:

- exact CSS architecture
- Zustand vs equivalent
- Tailwind vs CSS modules
- specific image viewer library
- exact thumbnail size within reasonable range
- exact API endpoint grouping
- exact long press milliseconds after real-device tuning
- exact virtualization page size
- exact conflict UI wording
- exact Worker vs Pages Functions structure

変更してはいけない:

- user-facing core behavior
- data ownership
- one-card-many-images model
- tree/hierarchy semantics
- back/viewport semantics
- privacy/security principles

---

# 206. CODEX WORKING PROCEDURE

このPromptを受け取ったら、いきなり大量変更を開始せず以下を行う。

## Step 1

Repositoryをinspect。

## Step 2

既存コード/構成を要約。

## Step 3

実装Phase Planを作る。

## Step 4

重大blockerがなければ作業開始。

ユーザーへ細かい確認を連発しない。

## Step 5

各Phase終了ごとに:

- typecheck
- tests
- build

## Step 6

Failureを修正してから次Phase。

## Step 7

最終E2E。

## Step 8

README / deployment instructions。

---

# 207. DO NOT CLAIM COMPLETION PREMATURELY

以下の場合「完成」と言わない。

- mock dataだけ
- R2未接続
- DB未接続
- Tree nodeが保存されない
- refreshで消える
- mobile gesture未確認
- back restore未確認
- test fail
- build fail
- PWA manifest onlyでService Workerなし
- buttons visible but no handler

---

# 208. FINAL REPORT FORMAT

完成時は短く明確に以下を報告。

## 1. 実装完了概要

実装した主機能。

## 2. 主要技術

React / Cloudflare / D1 / R2等。

## 3. DB migrations

作成ファイル。

## 4. Tests

- unit
- integration
- E2E
- build
- typecheck
- lint

結果。

## 5. iPhone確認

確認できた範囲。

実機確認できない場合は「実機未確認」と正直に書く。

## 6. Deploy手順

短く。

## 7. Known limitations

残る制約。

## 8. Future

MVP外のみ。

---

# 209. FINAL SELF-AUDIT

完成報告直前に自分で以下を再確認。

### Product model

- [ ] Series = container
- [ ] Root = real card
- [ ] Card = experiment
- [ ] Card supports multiple images
- [ ] Image list separates images
- [ ] title fallback = ID

### Home

- [ ] grid
- [ ] thumbnail
- [ ] ID/title only
- [ ] reorder
- [ ] create

### Detail

- [ ] left back
- [ ] right tree
- [ ] prompt preview
- [ ] copy
- [ ] carousel
- [ ] memo
- [ ] rating/tags

### Tree

- [ ] pan
- [ ] pinch
- [ ] long-press card movement
- [ ] no page scroll
- [ ] multi-parent
- [ ] primary
- [ ] reference
- [ ] edge color
- [ ] independent card
- [ ] root/fit
- [ ] viewport persist
- [ ] exact back

### Images

- [ ] photos-style
- [ ] virtualization
- [ ] filters
- [ ] sort
- [ ] favorite
- [ ] viewer
- [ ] tree focus

### Auth

- [ ] owner authentication
- [ ] PIN
- [ ] auto lock
- [ ] privacy overlay
- [ ] no sensitive first paint
- [ ] optional passkey

### Storage

- [ ] private R2
- [ ] original preserved
- [ ] thumbnail
- [ ] cleanup

### Data

- [ ] D1
- [ ] migrations
- [ ] version conflict
- [ ] indexes

### Export

- [ ] images
- [ ] csv
- [ ] json
- [ ] large dataset safe

### PWA

- [ ] manifest
- [ ] service worker
- [ ] standalone
- [ ] safe area
- [ ] dark mode

### QA

- [ ] typecheck
- [ ] lint
- [ ] unit
- [ ] E2E
- [ ] build

---

# 210. SUCCESS DEFINITION

このプロジェクトの成功は、
単に「画像とPromptが保存できる」ことではありません。

ユーザーがiPhoneで、

1. A-000という研究テーマを開く
2. 元画像とPromptを確認する
3. TREEへ移動する
4. A-001/A-002などの派生を追加する
5. 親子を線で結ぶ
6. 独立Cardも自由配置する
7. Cardを開いてPromptを確認する
8. Backすると元のTREE位置へ正確に戻る
9. IMAGESで全画像を写真アプリのように眺める
10. A/B等で絞り込む
11. 画像から元Card/TREEへ戻る
12. 後からPrompt研究の系譜を理解できる

という一連の体験が、
説明書を読まなくても直感的に成立することです。

これを最終品質基準としてください。

---

# 211. FUTURE-READY EXTENSION POINTS

MVPでは実装不要ですが、以下を後から足してもDBの根幹を作り直さなくてよいようにしてください。

- AI image generation provider integration
- richer experiment comparison
- prompt diff visualization
- card-to-card image comparison
- automatic image similarity
- shared research projects
- import/restore
- richer export
- prompt templates

ただし未来のためにMVPを過剰抽象化しないでください。

---

# 212. FINAL INSTRUCTION TO CODEX

この仕様は長いですが、重要度は均一ではありません。

特に絶対に落としてはいけない中心要件は次の10点です。

1. **iPhone-first**
2. **1 Card = 1 generation experiment**
3. **1 Cardに複数Images**
4. **TREEではCard 1個、IMAGESでは各Image別表示**
5. **SeriesごとのInfinite Canvas**
6. **Detail BackでTree viewport完全保持**
7. **TREE Page本体は1pxもScrollしない**
8. **Original imageを劣化させない**
9. **写真アプリ風Image List**
10. **Owner認証 + 4-digit PIN + 5分Auto Lock**

この10点を一般的な管理画面や簡略CRUDへ置き換えないでください。

実装結果が仕様とずれた場合、
「技術的には似ている」ではなく、
ユーザーがiPhoneで体験する操作そのものを基準に修正してください。

重大なブロッカーがなければ、
質問で停止せず、
調査 → 実装 → テスト → 修正 → 完成報告まで進めてください。


# ============================================================
# === END OF MASTER IMPLEMENTATION PROMPT ===
# ============================================================
