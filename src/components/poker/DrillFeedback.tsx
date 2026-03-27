import type { ReactNode } from 'react';

interface DrillFeedbackProps {
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  extraContent?: ReactNode;
  onNext: () => void;
  isLastQuestion: boolean;
  answerLabel?: string; // e.g. "Required equity" vs "Action"
}

export function DrillFeedback({
  isCorrect,
  userAnswer,
  correctAnswer,
  explanation,
  extraContent,
  onNext,
  isLastQuestion,
  answerLabel = 'Answer',
}: DrillFeedbackProps) {
  return (
    <div className={`drill-feedback ${isCorrect ? 'correct' : 'incorrect'}`}>
      <div className="drill-feedback-header">
        <span className="drill-feedback-icon">{isCorrect ? '✓' : '✗'}</span>
        <span>{isCorrect ? 'Correct!' : 'Not quite'}</span>
      </div>

      <div className="drill-feedback-body">
        <div className="feedback-answer-row">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{answerLabel}:</span>
          {!isCorrect && (
            <>
              <span className="feedback-user-answer wrong">{userAnswer}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
            </>
          )}
          <span className="feedback-correct-answer">{correctAnswer}</span>
        </div>

        <p className="feedback-explanation">{explanation}</p>

        {extraContent}
      </div>

      <div className="drill-feedback-footer">
        <button className="btn-primary" onClick={onNext}>
          {isLastQuestion ? 'See Results' : 'Next Question →'}
        </button>
      </div>
    </div>
  );
}
