import Image from "next/image";

export function Brand() {
  return (
    <Image
      src="/brand/calliper-logo.svg"
      alt="Calliper"
      width={168}
      height={40}
      className="calliper-logo"
      priority
    />
  );
}
