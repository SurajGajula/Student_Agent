interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
}

function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const handleUpgrade = () => {
    // Coming soon - does nothing
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content upgrade-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upgrade Plan</h2>
          <button className="modal-close" onClick={onClose}>
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="upgrade-plans">
          <div className="plan-card free-plan">
            <div className="plan-header">
              <h3>Free</h3>
              <div className="plan-price">$0<span className="plan-period">/month</span></div>
            </div>
            <ul className="plan-benefits">
              <li>Basic class management</li>
              <li>Note taking</li>
              <li>Up to 10 classes</li>
              <li>Basic calendar view</li>
            </ul>
            <button className="plan-button current-plan-button" disabled>
              Current Plan
            </button>
          </div>
          <div className="plan-card pro-plan">
            <div className="plan-header">
              <h3>Pro</h3>
              <div className="plan-price">$9.99<span className="plan-period">/month</span></div>
            </div>
            <ul className="plan-benefits">
              <li>Unlimited classes</li>
              <li>Advanced note features</li>
              <li>AI-powered study assistant</li>
              <li>Priority support</li>
              <li>Export & backup</li>
              <li>Custom themes</li>
            </ul>
            <button className="plan-button pro-plan-button" onClick={handleUpgrade}>
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpgradeModal

