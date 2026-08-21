# パチスロ実機の基本遊技工程：メーカー公式確認

Pioneerの公式「How to play Pachislot」は、トークンを3枚投入し、レバーを下げてリールを回転させ、中央の3つのSTOPボタンを左から右へ押して各リールを停止させることを、1回の遊技サイクルとして説明している。[1]

> “Put three tokens … then press down the lever … to spin the reels. … press the three Stop Buttons … from the left to right … This completes a cycle of play.” — Pioneer [1]

同資料では、ボーナスは図柄が揃った結果としてボーナスランプで示される。[1] この基本工程は、玉が始動口へ入るパチンコの抽選構造とは異なる。したがって、パチスロ実機を模す場合、レバーとSTOPを削除するのではなく、演出用PUSHと混同せず、**遊技サイクルを成立させる主入力**として再現しなければならない。

## 参照

[1] Pioneer Ltd. “Japan’s unique amusement ‘Pachislot’ — How to play” https://www.slot-pioneer.co.jp/global/en/howto.html

パチスロサミットONLINEの用語集は、疑似遊技・疑似停止を「本当遊技ではなく、演出としてリールが動作・停止すること」と定義している。[2] この区別から、GEKIAZU RUSHのBET・LEVER・STOPで進む主ゲームは疑似遊技に見えてはならず、入賞・クレジット変動・状態遷移を伴う実遊技として設計する必要がある。一方で、SYNC DROPやカットインの中で回胴を動かす場合は、実遊技を消費しない疑似演出であることを明確に分ける。

[2] パチスロサミットONLINE「用語集」 https://www.pachislot-summit.com/glossary/
