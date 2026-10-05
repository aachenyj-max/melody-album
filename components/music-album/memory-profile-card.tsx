import { normalizeProfile, type MemoryProfile } from "@/lib/memory/contract";

export function MemoryProfileCard({
  profile,
  photoCount,
}: {
  profile: MemoryProfile;
  photoCount: number;
}) {
  const valid = normalizeProfile(profile, photoCount);
  if (!valid)
    return (
      <div className="memory-profile-invalid" role="alert">
        理解结果不可用，请重新尝试。
      </div>
    );
  return (
    <section className="memory-profile-details" aria-label="记忆理解结果">
      <h2 className="sr-only">事件标题：{valid.title}</h2>
      <p>
        <b>人物</b>
        <span>{valid.people?.join("、") ?? "未识别"}</span>
      </p>
      <p>
        <b>事件</b>
        <span>{valid.event ?? "未识别"}</span>
      </p>
      <p>
        <b>氛围</b>
        <span>{valid.atmosphere ?? "未识别"}</span>
      </p>
      <p>
        <b>时间线</b>
        <span>
          {valid.timeline?.map((item) => item.label).join(" → ") ?? "未识别"}
        </span>
      </p>
      <p>
        <b>照片顺序</b>
        <span>{valid.photoOrder.map((index) => index + 1).join(" → ")}</span>
      </p>
    </section>
  );
}
