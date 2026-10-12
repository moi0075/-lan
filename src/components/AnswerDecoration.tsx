/** Decorative feedback stays inside the fixed question panel and never intercepts input. */
export default function AnswerDecoration() {
  return (
    <div className="answer-confetti" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
