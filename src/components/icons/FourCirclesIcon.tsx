interface FourCirclesIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export default function FourCirclesIcon({ size = 14, color = "#666666", ...props }: FourCirclesIconProps): JSX.Element {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      fill="none" 
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="7" cy="7" r="3" fill={color} />
      <circle cx="17" cy="7" r="3" fill={color} />
      <circle cx="7" cy="17" r="3" fill={color} />
      <circle cx="17" cy="17" r="3" fill={color} />
    </svg>
  );
}
