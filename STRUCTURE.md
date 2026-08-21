# GEKIAZU RUSH — Pachinko Runtime Structure

```text
GameCanvas (React picture frame)
├─ Babylon Engine / Scene
│  └─ cabinet backdrop, lamps, board light field
└─ DOM HUD
   ├─ LCD variation display / reach / outcome
   ├─ pachinko board / active ball layer / start pocket / reserve lamps
   ├─ attacker / round display / virtual ball counters
   └─ semantic handle and auxiliary push input

GameWorld (framework-agnostic)
├─ owns PachinkoState and all phase transitions
├─ advances simulated ball motion and detects start-pocket entry
├─ enqueues and consumes VariationContext values in FIFO reserve order
├─ owns jackpot / attacker / round / virtual-ball settlement
├─ owns timed presentation and cancellation
├─ owns AudioManager lifecycle
└─ publishes immutable snapshots to the React HUD

PachinkoEngine (pure domain)
├─ advances a ball through the board field
├─ resolves pin deflections and start-pocket capture
├─ creates variation contexts only on start-pocket capture
└─ produces symbol-stop and award data from the retained context
```

## Ownership

| Module | Responsibility |
| --- | --- |
| `game/types.ts` | パチンコのフェーズ、遊技球、保留、図柄、アタッカー、仮想BALL表示の語彙を定義する。 |
| `game/PachinkoEngine.ts` | 遊技球の盤面移動、始動口検出、保留時抽選、図柄停止、ラウンド報酬を純粋なゲーム規則として所有する。 |
| `game/assets.ts` | 既存のネオン神楽資産とパチンコ盤面資産の固定URLを管理する。 |
| `game/AudioManager.ts` | ハンドル、球発射、入賞、変動、リーチ、アタッカー、仮想払い出しの合成音を生成する。 |
| `game/GameWorld.ts` | ハンドル状態、遊技球更新、保留FIFO、演出タイムライン、履歴、状態通知を所有する。 |
| `game/scene.ts` | Babylonの背景シーン、筐体ランプ、盤面光、描画ループ接続を生成する。 |
| `components/GameCanvas.tsx` | シーンを安全にマウントし、盤面、液晶、ハンドル、情報層をHTML HUDとして反映する。 |

## Domain Boundary

このゲームで扱うのは、**仮想BALLを使う娯楽用の盤面体験**のみである。現金投入、玉貸し、換金、景品交換、外部口座、現実の金銭価値は、UI、状態、共有機能のいずれにも実装しない。
