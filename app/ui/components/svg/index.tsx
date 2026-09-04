import InlineSVG from "react-inlinesvg";

type SvgProps = {
  src: string;
  className?: string;
};

export const Svg = ({ src, className }: SvgProps) => {
  return <InlineSVG src={src} className={className} />;
};
