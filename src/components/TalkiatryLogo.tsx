import Image from "next/image";

// The logo is a JPEG-derived PNG with a white background; multiply blending
// drops that white so it sits cleanly on the off-white page background too.
export function TalkiatryLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/talkiatry-logo.png"
      alt="Talkiatry"
      width={640}
      height={163}
      priority
      className={`w-auto mix-blend-multiply ${className}`}
    />
  );
}
