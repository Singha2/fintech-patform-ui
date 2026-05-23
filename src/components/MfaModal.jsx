import { useState } from 'react'
import Button from './kit/Button.jsx'
import FormField from './kit/FormField.jsx'

export default function MfaModal({ action, onConfirm, onCancel }) {
  const [code, setCode] = useState('')
  const valid = /^\d{6}$/.test(code)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-80 mx-4">
        <h3 className="font-semibold text-gray-900 mb-1">MFA Re-verification Required</h3>
        <p className="text-sm text-gray-500 mb-4">
          Sensitive action: <span className="font-medium text-gray-800">{action}</span>.
          Enter your 6-digit TOTP code to confirm (C7).
        </p>
        <FormField
          label="TOTP Code"
          id="mfa-code"
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <Button onClick={() => valid && onConfirm()} disabled={!valid} className="flex-1">
            Confirm
          </Button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
