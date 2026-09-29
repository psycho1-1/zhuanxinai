'use client';
import { useEffect, useState } from 'react';
import BrandLogo from './brand-logo';
import CourseStudy from './course-study';
import { assetUrl } from '@/lib/studio';
import { studioRequest as api } from '@/lib/studio-client';
export default function CourseCatalog() {
  const [subject, setSubject] = useState('数学');
  const [grade, setGrade] = useState('初一');
  const [courses, setCourses] = useState<any[]>([]),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [id, setId] = useState('');
  async function load() {
    setError('');
    try {
      setCourses((await api('/api/courses')).courses);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败。');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="studio">
      <header className="studio-top">
        <a href="/">
          <BrandLogo />
        </a>
        <span>我的课程</span>
        <a className="studio-link" href="/?course=legacy">
          初一数学学习记录
        </a>
      </header>
      <main className="studio-catalog">
        {id ? (
          <>
            <button className="studio-back" onClick={() => setId('')}>
              ← 返回课程列表
            </button>
            <CourseStudy id={id} />
          </>
        ) : (
          <>
            <p className="studio-eyebrow">一步一步，学有所获</p>
            <h1>我的课程</h1>
            <p className="studio-muted">按知识点学习，留下每一次思考。</p>
            <section className="course-selector" aria-label="选择课程">
              <label>学科<select value={subject} onChange={e => setSubject(e.target.value)}><option>数学</option><option>物理</option><option>化学</option></select></label>
              <label>年级<select value={grade} onChange={e => setGrade(e.target.value)}><option>初一</option><option>初二</option><option>初三</option></select></label>
            </section>
            {error && (
              <p className="studio-alert">
                {error} <button onClick={() => void load()}>重试</button>
              </p>
            )}
            {!ready && !error && <p role="status">正在读取课程…</p>}
            {ready && !(subject === '数学' && grade === '初一') && !courses.some(c => (c.subject ?? '数学') === subject && (c.grade ?? '初一') === grade) && (
              <section className="studio-empty">
                <h2>{grade}{subject}课程正在准备中</h2>
                <p>课程发布后会显示在这里，请选择其他学科或年级。</p>
              </section>
            )}
            <div className="studio-course-grid">
              {subject === '数学' && grade === '初一' && <article className="studio-course-card"><div className="studio-course-art">数学 · 初一</div><div><small>七年级上册 · 人教版（2024）</small><h2>初一数学</h2><p>视频、知识点练习、错题本和学习进度。</p><a className="studio-link" href="/?course=legacy">进入课程 →</a></div></article>}
              {courses.filter(c => (c.subject ?? '数学') === subject && (c.grade ?? '初一') === grade).map((c) => (
                <article className="studio-course-card" key={c.id}>
                  {c.coverId ? (
                    <img src={assetUrl(c.coverId)} alt={c.title} />
                  ) : (
                    <div className="studio-course-art">一步 · 一知</div>
                  )}
                  <div>
                    <small>{c.grade ?? '初一'} · {c.subject ?? '数学'} · {c.segments} 个学习片段</small>
                    <h2>{c.title}</h2>
                    <p>{c.description}</p>
                    <button
                      className="studio-primary"
                      onClick={() => setId(c.id)}
                    >
                      {c.enrolledVersion ? '继续学习' : '开始学习'} →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
