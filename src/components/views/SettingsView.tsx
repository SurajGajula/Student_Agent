import { useEffect } from 'react'
import { useUsageStore } from '../../stores/usageStore'
import { useAuthStore } from '../../stores/authStore'

function SettingsView() {
  const { planName, tokensUsed, monthlyLimit, remaining, isLoading, error, fetchUsage } = useUsageStore()
  const { isLoggedIn } = useAuthStore()

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsage()
    }
  }, [isLoggedIn, fetchUsage])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const usagePercentage = monthlyLimit > 0 ? (tokensUsed / monthlyLimit) * 100 : 0

  if (!isLoggedIn) {
    return (
      <div className="settings-view">
        <div className="settings-container">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-message">Please log in to view your usage and settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-view">
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>
        
        {isLoading ? (
          <div className="settings-loading">Loading usage data...</div>
        ) : error ? (
          <div className="settings-error">Error: {error}</div>
        ) : (
          <div className="settings-content">
            <div className="settings-section">
              <h2 className="settings-section-title">Usage</h2>
              
              <div className="usage-info">
                <div className="usage-plan">
                  <span className="usage-label">Current Plan:</span>
                  <span className="usage-value usage-plan-name">{planName.toUpperCase()}</span>
                </div>
                
                <div className="usage-stats">
                  <div className="usage-stat">
                    <span className="usage-label">Tokens Used:</span>
                    <span className="usage-value">{formatNumber(tokensUsed)}</span>
                  </div>
                  
                  <div className="usage-stat">
                    <span className="usage-label">Monthly Limit:</span>
                    <span className="usage-value">{formatNumber(monthlyLimit)}</span>
                  </div>
                  
                  <div className="usage-stat">
                    <span className="usage-label">Remaining:</span>
                    <span className="usage-value">{formatNumber(remaining)}</span>
                  </div>
                </div>
                
                <div className="usage-progress-container">
                  <div className="usage-progress-bar">
                    <div 
                      className="usage-progress-fill"
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                  <div className="usage-progress-text">
                    {usagePercentage.toFixed(1)}% used
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsView

