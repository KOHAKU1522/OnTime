export const otherApps = [
    {
        title: "Number Hunt",
        subtitle: `「Number Hunt」は画面上に散らばった数字の中から、指定されたナンバーを見つけ出すゲームです。スコアが上がるにつれてタイル数が増える、動的な難易度変化が特徴です。

技術的なポイント
・Firestoreをバックエンドに採用し、ユーザーのスコア登録から世界ランキングの反映までをリアルタイムに処理しています。

・requestAnimationFrameを使用することで、ブラウザの描画リフレッシュレートに合わせた滑らかな残り時間表示を実現しています。

・PWAへの対応。マニフェストファイルの実装により、スマホのホーム画面にアイコンを追加して、ネイティブアプリのような感覚で起動できるよう設計しています。
`,
        imageSrc: "/images/NumberHuntImg.png",
        link: "https://numberhunt-web.netlify.app/",
    },
    {
        title: "WariCalc",
        subtitle: `「WariCalc」は、グループでの飲み会やイベントの精算をスムーズにする割り勘特化型計算ツールです。
単に合計金額を等分するだけでなく、参加者ごとの支払い状況や端数の処理を直感的に操作できる設計になっています。

技術的なポイント
メンテナンス性を意識したモジュール化やCSS設計（Sanitize.cssの採用など）を行い、軽量で高速な動作を実現しています。
`,
        imageSrc: "/images/WariCalcImg.png",
        link: "https://waricalc-web.netlify.app/",
    },
    {
        title: "ちいかわキャラ診断",
        // subtitle: "診断",
        imageSrc: "/images/chiikawaSindan.png",
        link: "https://famous-lamington-b0cd03.netlify.app/",
    },
    {
        title: "Tabaco Scale",
        subtitle: `「Tabaco Scale」は、喫煙習慣がもたらす「時間」と「お金」の消費を、身近な具体例に置き換えて視覚化するライフスタイル分析ツールです。単なる数値表示にとどまらず、「このお金があれば何が買えるか」「この時間があれば何ができるか」をリアルな尺度で示すことができます。

技術的なポイント
・Reactのコンポーネント指向の設計。 UIを独立した再利用可能なパーツ(Component)に分割し、メンテナンス性と拡張性の高いコードベースを構築しています。

・useStateやuseEffectなどのReact Hooksを駆使し、複雑なユーザー操作に対してDOMを直接操作することなくスマートにUIを同期させています。
        `,
        imageSrc: "/images/TabacoScale.png",
        link: "https://tabacoscale-web.netlify.app/",
    },
]