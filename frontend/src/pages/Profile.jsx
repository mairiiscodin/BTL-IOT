import React from 'react';
import { Header, Icon, asset } from '../components';
// Nhan thong tin nguoi dung tu App de hien thi ho so va cac lien ket tai lieu du an.
export function Profile({ user }) {
  return (
    <>
      {/* Hien thi tieu de trang ho so. */}
      <Header title="Developer Profile" subtitle="Dashboard designed and integrated by" />
      <section className="card profile">
        {/* Hien thi anh mau, ho ten nguoi dung va vai tro trong du an. */}
        <div className="profile-top">
          <img
            className="avatar"
            src={asset('imgStudentPhoto', '2_448')}
            alt="Ảnh mẫu từ thiết kế Figma"
          />
          <h2>{user.fullName}</h2>
          <small>PROJECT DEVELOPER</small>
        </div>
        {/* Tao cac dong thong tin ho ten, lop va ma sinh vien tu du lieu nguoi dung. */}
        <div className="profile-details">
          {[
            ['Full Name (Họ tên)', user.fullName],
            ['Class (Lớp)', user.className],
            ['Student ID (Mã sinh viên)', user.studentId],
          ].map(([k, v]) => (
            <div className="row" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        {/* Hien thi lien ket ma nguon, thiet ke va tai lieu; bao chua cau hinh neu URL rong. */}
        <h3>PROJECT DELIVERABLES</h3>
        {[
          ['GitHub Repository', import.meta.env.VITE_REPOSITORY_URL, 'imgCpu1'],
          [
            'Figma UI/UX Mockup',
            'https://www.figma.com/design/ERAHhh6o3aYMh0dwXZelj1/LeXuanCuong-B23DCCN111-IOT',
            'imgSun',
          ],
          ['Postman API Documentation', '/docs/API.md', 'imgChartColumn1'],
          ['PDF Project Report', '/docs/report.pdf', 'imgFolder1'],
        ].map(([name, url, icon]) => (
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
