import { useState } from 'react'
import { useTestsStore, type Test } from '../../stores/testsStore'

function TestsView() {
  const [currentTestId, setCurrentTestId] = useState<string | null>(null)
  const { tests, removeTest, getTestById } = useTestsStore()
  const currentTest = currentTestId ? getTestById(currentTestId) : null

  const handleTestClick = (testId: string) => {
    setCurrentTestId(testId)
  }

  const handleBackClick = () => {
    setCurrentTestId(null)
  }

  const handleDeleteTest = (e: React.MouseEvent, testId: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this test?')) {
      removeTest(testId)
      if (currentTestId === testId) {
        setCurrentTestId(null)
      }
    }
  }

  // Render test detail view with questions
  if (currentTestId && currentTest) {
    return (
      <div className="tests-view">
        <div className="tests-header">
          <div className="header-title">
            <button className="back-button" onClick={handleBackClick}>
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1>{currentTest.name}</h1>
          </div>
        </div>
        <div className="test-detail-container">
          <div className="test-info">
            <p className="test-source">Based on note: {currentTest.noteName}</p>
            <p className="test-questions-count">{currentTest.questions.length} questions</p>
          </div>
          <div className="test-questions">
            {currentTest.questions.map((question, index) => (
              <div key={question.id} className="test-question-card">
                <div className="question-header">
                  <span className="question-number">Question {index + 1}</span>
                  <span className="question-type">{question.type === 'multiple-choice' ? 'Multiple Choice' : 'Short Answer'}</span>
                </div>
                <div className="question-text">{question.question}</div>
                {question.type === 'multiple-choice' && question.options && (
                  <div className="question-options">
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="question-option">
                        <span className="option-label">{String.fromCharCode(65 + optIndex)}.</span>
                        <span className="option-text">{option}</span>
                        {question.correctAnswer === option && (
                          <span className="correct-indicator">✓ Correct</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {question.type === 'short-answer' && question.correctAnswer && (
                  <div className="question-answer">
                    <strong>Answer:</strong> {question.correctAnswer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Render tests grid/list view
  return (
    <div className="tests-view">
      <div className="tests-header">
        <div className="header-title">
          <h1>Tests</h1>
        </div>
      </div>

      <div className="tests-grid">
        {tests.length === 0 ? (
          <div className="empty-state">
            <p>No tests yet. Use @ to mention a note in chat and ask to "turn notes into a test" to create one.</p>
          </div>
        ) : (
          tests.map((test: Test) => (
            <div key={test.id} className="test-card" onClick={() => handleTestClick(test.id)}>
              <button 
                className="card-delete-button"
                onClick={(e) => handleDeleteTest(e, test.id)}
                aria-label="Delete test"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
              <div className="test-card-icon">
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <h3>{test.name}</h3>
              <p className="test-card-meta">
                {test.questions.length} questions • From: {test.noteName}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TestsView

