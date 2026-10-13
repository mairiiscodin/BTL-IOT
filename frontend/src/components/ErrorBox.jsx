import React from 'react';
export function ErrorBox({ message }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
