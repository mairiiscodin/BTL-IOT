import React from 'react';
export const asset = (name, group = 'dashboard') =>
  `/assets/${group}_${name}.${name === 'imgStudentPhoto' ? 'png' : 'svg'}`;
export const Icon = ({ name, group }) => (
  <span className="icon" aria-hidden="true">
    <img src={asset(name, group)} alt="" />
  </span>
);
