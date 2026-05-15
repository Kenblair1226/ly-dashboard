export default function IvodGallery({ ivods }: { ivods: any[] }) {
  if (!ivods?.length) return <div className="text-slate-500 text-sm">尚無 IVOD 影片</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {ivods.map((iv) => (
        <a
          key={iv.ivod_id}
          href={iv.ivod_url}
          target="_blank"
          rel="noreferrer"
          className="block bg-white border rounded p-3 hover:shadow"
        >
          <div className="text-xs text-slate-500">{iv.date}</div>
          <div className="text-sm font-medium mt-1 line-clamp-3">{iv.meet_name}</div>
          <div className="text-xs text-slate-500 mt-1">⏱ {iv.speech_time}</div>
        </a>
      ))}
    </div>
  );
}
