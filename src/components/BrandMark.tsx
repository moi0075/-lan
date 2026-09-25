/** A small rising path: each step stands for a skill gained through practice. */
export default function BrandMark({ size = 25 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 36h8V27h8v-9h8V9h8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="9" r="4" fill="#F3B578" />
    </svg>
  );
}
