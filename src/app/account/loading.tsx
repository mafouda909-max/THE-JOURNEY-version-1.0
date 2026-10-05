export default function WorkspaceLoading() {
  return (
    <div role="status" className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <p className="mb-6 text-sm font-semibold text-slate">
        جارٍ تحميل مساحة العمل…
      </p>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-32 rounded-3xl border border-outlinev bg-cloud"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
