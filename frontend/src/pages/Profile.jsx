import React from 'react';
import { Header, Icon, asset } from '../components';

// Các liên kết tài liệu dự án: [tên, URL, icon]. URL rỗng => hiện "Chưa cấu hình URL".
const DELIVERABLES = [
  ['GitHub Repository', 'https://github.com/mairiiscodin/BTL-IOT', 'imgCpu1'],
  [
    'Figma',
    'https://www.figma.com/design/ERAHhh6o3aYMh0dwXZelj1/LeXuanCuong-B23DCCN111-IOT',
    'imgSun',
  ],
  ['Postman API Documentation', '/docs/API.md', 'imgChartColumn1'],
  [
    'Project Report',
    'https://docs.google.com/document/d/1Cho2rIian3918TbC6ms1UbMW0lI77gNgm-GsKQY8Qos/edit?tab=t.0#heading=h.v51v0ppstma',
    'imgFolder1',
  ],
];

// Trang hồ sơ: thông tin sinh viên (lấy từ /auth/me) và liên kết tài liệu.
export function Profile({ user }) {
  const details = [
    ['Full Name (Họ tên)', user.fullName],
    ['Class (Lớp)', user.className],
    ['Student ID (Mã sinh viên)', user.studentId],
    ['Role (Quyền)', user.role],
  ];

  return (
    <>
      <Header title="Developer Profile" subtitle="Dashboard designed and integrated by" />
      <section className="card profile">
        <div className="profile-top">
          <img
            className="avatar"
            src={asset('imgStudentPhoto', '2_448')}
            alt="Ảnh mẫu từ thiết kế Figma"
          />
          <h2>{user.fullName}</h2>
          <small>PROJECT DEVELOPER</small>
        </div>

        <div className="profile-details">
          {details.map(([label, value]) => (
            <div className="row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <h3>PROJECT DELIVERABLES</h3>
        {DELIVERABLES.map(([name, url, icon]) => (
          <div className="deliverable" key={name}>
            <Icon name={icon} group="2_448" />
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {name}
              </a>
            ) : (
              <span>
                {name} <small>Chưa cấu hình URL</small>
              </span>
            )}
            <Icon name="imgLogOut1" group="2_448" />
          </div>
        ))}
      </section>
    </>
  );
}
