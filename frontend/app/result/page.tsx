import Link from "next/link";

type SubScore = {
  score: number;
  label: string;
};

type AnalyzeResult = {
  scoreTotal: number;
  ageRange: string;
  subScores: {
    imageQuality: SubScore;
    facePose: SubScore;
    expression: SubScore;
    contour: SubScore;
    style: SubScore;
  };
  freeSummary: string[];
  isLocked: boolean;
};

type ResultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const defaultResult: AnalyzeResult = {
  scoreTotal: 7.85,
  ageRange: "24-28\u5c81",
  subScores: {
    imageQuality: { score: 8.1, label: "\u56fe\u50cf\u8d28\u91cf" },
    facePose: { score: 7.6, label: "\u8138\u90e8\u59ff\u6001" },
    expression: { score: 7.9, label: "\u8868\u60c5\u72b6\u6001" },
    contour: { score: 7.7, label: "\u8f6e\u5ed3\u6e05\u6670\u5ea6" },
    style: { score: 8.0, label: "\u98ce\u683c\u5b8c\u6210\u5ea6" },
  },
  freeSummary: ["\u5efa\u8bae1", "\u5efa\u8bae2", "\u5efa\u8bae3"],
  isLocked: true,
};

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  const dataParam = Array.isArray(params.data) ? params.data[0] : params.data;

  let result = defaultResult;

  if (dataParam) {
    try {
      result = JSON.parse(dataParam) as AnalyzeResult;
    } catch {
      result = defaultResult;
    }
  }

  const subScoreList = Object.entries(result.subScores);

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-lg flex-col gap-5">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">MirrorScore</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {"\u81ea\u62cd\u4e0a\u955c\u8868\u73b0\u5206\u6790\u7ed3\u679c"}
          </p>
        </div>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center shadow-2xl shadow-black/20">
          <p className="text-6xl font-bold">{result.scoreTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-emerald-100">
            {"\u4e0a\u955c\u8868\u73b0\u5206"}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-neutral-300">
            {"\u89c6\u89c9\u5e74\u9f84\u533a\u95f4"}
          </p>
          <p className="mt-2 text-2xl font-semibold">{result.ageRange}</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {"\u4e94\u7ef4\u5206\u9879"}
            </h2>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
              {"\u514d\u8d39\u9884\u89c8"}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {subScoreList.map(([key, item]) => (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span>{item.score.toFixed(1)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-white"
                    style={{ width: `${Math.min(item.score, 10) * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {"\u514d\u8d39\u5efa\u8bae"}
            </h2>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
              {"\u514d\u8d39\u9884\u89c8"}
            </span>
          </div>
          <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 text-sm text-neutral-200">
            {result.freeSummary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5">
          <div className="select-none rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-white/25 blur-sm">
            <p>
              {"\u4e94\u7ef4\u7ec6\u8282\u5206\u6790\u5c06\u5728\u89e3\u9501\u540e\u5c55\u5f00\uff0c\u5305\u542b\u62cd\u6444\u95ee\u9898\u62c6\u89e3\u3001\u7f3a\u9677\u539f\u56e0\u5224\u65ad\u3001\u63d0\u5347\u65b9\u5411\u4e0e\u5bf9\u5e94\u6539\u8fdb\u7b56\u7565\u3002"}
            </p>
            <p>
              {"\u66f4\u591a\u5185\u5bb9\u5305\u542b\u4e2a\u6027\u5316\u5efa\u8bae\u3001\u98ce\u683c\u4f18\u5316\u8def\u5f84\u3001\u66f4\u9002\u5408\u4f60\u7684\u6784\u56fe\u4e0e\u5149\u7ebf\u65b9\u6848\u3002"}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/25 p-5">
            <p className="text-lg font-semibold text-amber-50">
              {"\u5b8c\u6574\u5206\u6790\u62a5\u544a"}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              {"\u89e3\u9501\u540e\u5305\u542b\uff1a\u4e94\u7ef4\u8be6\u7ec6\u5206\u6790 \u00b7 12\u6761\u5b9a\u5236\u4f18\u5316\u5efa\u8bae \u00b7 \u4e13\u4e1a\u6539\u8fdb\u8def\u7ebf\u56fe"}
            </p>
            <p className="mt-5 text-3xl font-bold tracking-tight text-white">
              {"\u00a59.9 \u89e3\u9501\u5b8c\u6574\u62a5\u544a"}
            </p>
            <p className="mt-2 text-xs text-amber-100/70">
              {"\u4e00\u6b21\u4ed8\u8d39\uff0c\u6c38\u4e45\u67e5\u770b\u672c\u6b21\u62a5\u544a"}
            </p>
            <button
              type="button"
              className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-black/20 transition hover:bg-amber-50"
            >
              {"\u7acb\u5373\u89e3\u9501 \u00a59.9"}
            </button>
          </div>
        </section>

        <Link
          href="/"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {"\u91cd\u65b0\u5206\u6790"}
        </Link>
      </div>
    </main>
  );
}
