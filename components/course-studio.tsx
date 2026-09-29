'use client';
import { useEffect, useState } from 'react';
import BrandLogo from './brand-logo';
import CourseStudy from './course-study';
import {
  emptySegment,
  flattenSegments,
  assetUrl,
  type StudioCourse,
  type CourseRow,
  type CourseSummary,
  type StudioQuestion,
} from '@/lib/studio';
import { studentDocument, publishIssues } from '@/server/studio/content';
import { studioRequest as api, exportJSON, StudioRequestError } from '@/lib/studio-client';
import { mediaInputError, uploadFailure } from '@/lib/media-upload';
type Asset = { id: string; name: string; mime: string; bytes: number };
type PendingUpload = { file: File; id: string; url: string; chunkBytes: number; nextPart: number };
type View = 'edit' | 'preview' | 'assets' | 'versions' | 'reports';
export default function CourseStudio() {
  const [ready, setReady] = useState(false),
    [denied, setDenied] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<CourseSummary[]>([]),
    [course, setCourse] = useState<CourseRow | null>(null),
    [assets, setAssets] = useState<Asset[]>([]),
    [versions, setVersions] = useState<{ id: string; created_at: number }[]>(
      [],
    ),
    [reports, setReports] = useState<any[]>([]),
    [enrollments, setEnrollments] = useState<any[]>([]),
    [reportPage, setReportPage] = useState(0);
  const [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState(''),
    [view, setView] = useState<View>('edit'),
    [upload, setUpload] = useState<number | null>(null);
  const locked = busy || upload !== null;
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [trash, setTrash] = useState<CourseSummary[]>([]);
  const [trashMode, setTrashMode] = useState(false);
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!dirty && !pendingUpload) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pendingUpload]);
  async function load() {
    setError('');
    try {
      const r = await api('/api/studio');
      setCourses(r.courses);
      setTrash(r.trash ?? []);
      setAssets(r.assets);
      setReady(true);
      setDenied(false);
    } catch (e) {
      setError(message(e));
      setDenied(e instanceof StudioRequestError && (e.status === 401 || e.status === 403));
    }
  }
  const message = (e: unknown) =>
    e instanceof Error ? e.message : '操作未完成，请重试。';
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function edit(fn: (draft: StudioCourse) => void) {
    if (locked) return;
    setCourse((c) => {
      if (!c) return c;
      const draft = structuredClone(c.draft);
      fn(draft);
      return { ...c, draft };
    });
    setDirty(true);
    setNotice('');
  }
  const selectedSegment = course
    ? flattenSegments(course.draft).find((s) => s.id === selected)
    : undefined;
  function editSegment(patch: Record<string, unknown>) {
    edit((d) => {
      const s = flattenSegments(d).find((s) => s.id === selected);
      if (s) Object.assign(s, patch);
    });
  }
  function question(id: string, patch: Partial<StudioQuestion>) {
    edit((d) => {
      const q = flattenSegments(d)
        .find((s) => s.id === selected)
        ?.questions.find((q) => q.id === id);
      if (q) Object.assign(q, patch);
    });
  }
  function accept(r: any) {
    setCourse(r.course);
    setVersions(r.history ?? []);
    setDirty(false);
  }
  async function open(id: string) {
    if (dirty && !confirm('当前修改尚未保存，确定放弃这些修改并切换课程吗？'))
      return;
    await task(async () => {
      const r = await api(`/api/studio?id=${id}`);
      accept(r);
      setAssets(r.assets);
      setSelected('');
      setView('edit');
    });
  }
  async function save() {
    if (!course) return;
    await task(async () => {
      accept(
        await api('/api/studio', {
          action: 'save',
          id: course.id,
          revision: course.revision,
          course: course.draft,
        }),
      );
      setNotice('草稿已保存。学生看到的正式版本未改变。');
      await refreshList();
    });
  }
  async function refreshList() {
    const r = await api('/api/studio');
    setCourses(r.courses);
    setTrash(r.trash ?? []);
    setAssets(r.assets);
  }
  async function removeDraft(c: CourseSummary) {
    if (!confirm(`将“${c.title}”移入回收站？素材库中的视频和图片会保留。`)) return;
    await task(async () => {
      await api('/api/studio', { action: 'trash', id: c.id, revision: c.revision });
      if (course?.id === c.id) { setCourse(null); setDirty(false); }
      await refreshList();
      setNotice('草稿已移入回收站，可以随时恢复。');
    });
  }
  async function removeEmptyDrafts() {
    if (!confirm('将未发布、未填写介绍和封面、没有章节的“未命名课程”移入回收站？其他课程和素材会保留。')) return;
    await task(async () => {
      const result = await api('/api/studio', { action: 'trash-empty' });
      const fresh = await api('/api/studio');
      setCourses(fresh.courses); setTrash(fresh.trash ?? []); setAssets(fresh.assets);
      if (course && !fresh.courses.some((c: CourseSummary) => c.id === course.id)) { setCourse(null); setDirty(false); }
      setNotice(`已将 ${result.count} 门空白草稿移入回收站。`);
    });
  }
  function addChapter() {
    edit((d) =>
      d.chapters.push({
        id: crypto.randomUUID(),
        title: `第 ${d.chapters.length + 1} 章`,
        lessons: [],
      }),
    );
  }
  const reorder = <T,>(items: T[], index: number, delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < items.length)
      [items[index], items[next]] = [items[next], items[index]];
  };
  function remove(action: () => void) {
    if (confirm('从当前草稿移除？已发布版本和历史学习记录会保留。')) action();
  }
  async function uploadFile(file: File, resume = false) {
    setUpload(0);
    setError('');
    setNotice('');
    try {
      const type =
        file.type ||
        (file.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : '');
      const invalid = mediaInputError(file.name, type, file.size);
      if (invalid) throw new Error(invalid);
      const signed: PendingUpload = resume && pendingUpload ? pendingUpload : { ...await api('/api/studio/assets', {
        action: 'sign',
        name: file.name,
        mime: type,
        bytes: file.size,
      }), file, nextPart: 0 };
      setPendingUpload(signed);
      const count = Math.ceil(file.size / signed.chunkBytes);
      for (let part = signed.nextPart; part < count; part++) {
        const chunk = file.slice(part * signed.chunkBytes, (part + 1) * signed.chunkBytes);
        for (let attempt = 0; ; attempt++) {
          try { await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `${signed.url}&part=${part}`);
        xhr.timeout = 55000;
        xhr.setRequestHeader('Content-Type', type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setUpload(Math.min(99, Math.round(((part * signed.chunkBytes + e.loaded) / file.size) * 100)));
        };
        xhr.onerror = () =>
          reject(new Error('上传中断，请检查网络后重新上传。'));
        xhr.ontimeout = () => reject(new Error(uploadFailure(504)));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          let detail: { error?: string; code?: string } = {};
          try { detail = JSON.parse(xhr.responseText); } catch { /* Gateway HTML is not shown to users. */ }
          reject(new Error(detail.error || uploadFailure(xhr.status, detail.code)));
        };
        xhr.send(chunk);
      }); break; } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
        }
        signed.nextPart = part + 1;
        setPendingUpload({ ...signed });
      }
      setUpload(100);
      await api('/api/studio/assets', { action: 'complete', id: signed.id });
      setPendingUpload(null);
      await refreshList();
      setNotice('上传成功，现在可以在片段或课程封面中选择这个素材。');
    } catch (e) {
      setError(message(e));
    } finally {
      setUpload(null);
    }
  }
  async function showReports(page = 0) {
    if (!course) return;
    await task(async () => {
      const r = await api(
        `/api/studio?id=${course.id}&reports=1&offset=${page * 100}`,
      );
      setReports(r.reports);
      setEnrollments(r.enrollments);
      setReportPage(page);
      setView('reports');
    });
  }
  const issues = course ? publishIssues(course.draft) : [];
  return (
    <div className="studio">
      <header className="studio-top">
        <a href="/">
          <BrandLogo />
        </a>
        <span>课程工作台</span>
        <a className="studio-link" href="/courses">
          学生课程
        </a>
        <a className="studio-link" href="/">
          返回原课程
        </a>
      </header>
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <p className="studio-eyebrow">内容管理</p>
          <h1>我的课程</h1>
          <p className="studio-muted">先搭结构，视频可以稍后上传。</p>
          <button
            className="studio-primary"
            disabled={!ready || locked}
            onClick={() => {
              if (dirty && !confirm('放弃当前未保存修改并新建课程？')) return;
              void task(async () => {
                setTrashMode(false);
                accept(await api('/api/studio', { action: 'create' }));
                setSelected('');
                setView('edit');
                await refreshList();
              });
            }}
          >
            ＋ 新建课程
          </button>
          <div className="studio-draft-tools">
            <button disabled={locked || dirty || !ready} onClick={() => setTrashMode(!trashMode)}>
              {trashMode ? '返回课程列表' : `回收站（${trash.length}）`}
            </button>
            {!trashMode && <button disabled={locked || dirty || !courses.some(c => c.emptyDraft)} onClick={() => void removeEmptyDrafts()}>清理空白草稿</button>}
          </div>
          <nav aria-label="管理课程列表">
            {!trashMode && courses.map((c) => (
              <div key={c.id} className="studio-draft-item">
              <button
                className={`studio-course-link ${course?.id === c.id ? 'is-active' : ''}`}
                key={c.id}
                disabled={locked}
                onClick={() => void open(c.id)}
              >
                <strong>{c.title}</strong>
                <small>
                  {c.archived
                    ? '已下架'
                    : c.published_version
                      ? '已发布 · 可继续编辑'
                      : '草稿'}{' '}
                  · {c.segments} 个片段
                </small>
              </button>
              {!c.published_version && <button className="studio-draft-delete" disabled={locked || dirty} onClick={() => void removeDraft(c)} aria-label={`删除草稿：${c.title}`}>删除草稿</button>}
              </div>
            ))}
          </nav>
        </aside>
        <main className="studio-main">
          {error && (
            <div className="studio-alert" role="alert">
              {error}
              {denied && (
                <>
                  {' '}
                  <a href="/login">切换登录账号</a>{' '}
                </>
              )}
              <button disabled={locked} onClick={() => void load()}>重新检查</button>
            </div>
          )}
          {notice && (
            <p className="studio-notice" role="status">
              {notice}
            </p>
          )}
          {!ready && !error && <p role="status">正在验证管理权限…</p>}
          {ready && trashMode && (
            <section className="studio-fields">
              <h2>回收站</h2>
              <p className="studio-muted">这里的课程可以恢复。视频和图片仍保存在素材库中。</p>
              {trash.length === 0 && <p>回收站是空的。</p>}
              {trash.map(c => <div className="studio-history" key={c.id}>
                <div><strong>{c.title}</strong><p>{c.segments} 个片段 · {new Date(c.updated_at).toLocaleDateString('zh-CN')} 移入</p></div>
                <button disabled={locked} onClick={() => void task(async () => {
                  await api('/api/studio', { action: 'restore-trash', id: c.id, revision: c.revision });
                  await refreshList(); setNotice('草稿已恢复到课程列表。');
                })}>恢复草稿</button>
              </div>)}
            </section>
          )}
          {ready && !course && !trashMode && (
            <section className="studio-empty">
              <span className="studio-empty-icon">＋</span>
              <h2>从第一节课开始</h2>
              <p>创建课程，添加章节和学习片段。没有视频也能保存草稿。</p>
              <p>正式发布前，系统会检查视频、题目和参考答案。</p>
            </section>
          )}
          {course && !trashMode && (
            <>
              <div className="studio-title">
                <div>
                  <p className="studio-eyebrow">
                    {course.published_version ? '已有正式版本' : '课程草稿'} ·{' '}
                    {dirty ? '有未保存修改' : '已保存'}
                  </p>
                  <h2>{course.draft.title}</h2>
                </div>
                <div className="studio-actions">
                  <button
                    disabled={locked}
                    onClick={() =>
                      exportJSON(
                        course.draft,
                        `${course.draft.title}-草稿.json`,
                      )
                    }
                  >
                    导出草稿
                  </button>
                  <button
                    disabled={locked || !dirty}
                    onClick={() => void save()}
                  >
                    保存草稿
                  </button>
                  <button
                    className="studio-primary"
                    disabled={locked || dirty || !!issues.length}
                    onClick={() =>
                      void task(async () => {
                        accept(
                          await api('/api/studio', {
                            action: 'publish',
                            id: course.id,
                            revision: course.revision,
                          }),
                        );
                        setNotice(
                          '课程已发布，新学生可以开始学习。已开始的学习记录继续对应原版本。',
                        );
                        await refreshList();
                      })
                    }
                  >
                    发布课程
                  </button>
                </div>
              </div>
              <div className="studio-tabs" role="group" aria-label="工作台视图">
                {(
                  [
                    ['edit', '编辑内容'],
                    ['preview', '学生预览'],
                    ['assets', '素材库'],
                    ['versions', '发布记录'],
                    ['reports', '学习情况'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={view === key}
                    disabled={locked}
                    onClick={() =>
                      key === 'reports' ? void showReports() : setView(key)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === 'edit' && (
                <>
                  <details className="studio-validation">
                    <summary>
                      {issues.length
                        ? `${issues.length} 项发布准备待完成`
                        : '发布检查通过'}
                      {dirty ? ' · 请先保存草稿' : ''}
                    </summary>
                    {issues.length ? (
                      <ul>
                        {issues.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>内容已齐全，发布前建议先查看学生预览。</p>
                    )}
                  </details>
                  <div className="studio-editor">
                    <section className="studio-outline">
                      <button
                        className={!selected ? 'is-active' : ''}
                        onClick={() => setSelected('')}
                      >
                        课程基本信息
                      </button>
                      {course.draft.chapters.map((ch, ci) => (
                        <div className="studio-chapter" key={ch.id}>
                          <label>
                            章节名称
                            <input
                              aria-label={`第${ci + 1}章名称`}
                              value={ch.title}
                              onChange={(e) =>
                                edit((d) => {
                                  d.chapters[ci].title = e.target.value;
                                })
                              }
                            />
                          </label>
                          <div className="studio-tiny-actions">
                            <button
                              title="上移章节"
                              disabled={ci === 0}
                              onClick={() =>
                                edit((d) => reorder(d.chapters, ci, -1))
                              }
                            >
                              ↑
                            </button>
                            <button
                              title="下移章节"
                              disabled={ci === course.draft.chapters.length - 1}
                              onClick={() =>
                                edit((d) => reorder(d.chapters, ci, 1))
                              }
                            >
                              ↓
                            </button>
                            <button
                              onClick={() =>
                                remove(() =>
                                  edit((d) => {
                                    d.chapters.splice(ci, 1);
                                  }),
                                )
                              }
                            >
                              移除章节
                            </button>
                          </div>
                          {ch.lessons.map((l, li) => (
                            <div className="studio-lesson" key={l.id}>
                              <label>
                                课时名称
                                <input
                                  aria-label={`课时名称 ${l.id}`}
                                  value={l.title}
                                  onChange={(e) =>
                                    edit((d) => {
                                      d.chapters[ci].lessons[li].title =
                                        e.target.value;
                                    })
                                  }
                                />
                              </label>
                              <div className="studio-tiny-actions">
                                <button
                                  title="上移课时"
                                  disabled={li === 0}
                                  onClick={() =>
                                    edit((d) =>
                                      reorder(d.chapters[ci].lessons, li, -1),
                                    )
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  title="下移课时"
                                  disabled={li === ch.lessons.length - 1}
                                  onClick={() =>
                                    edit((d) =>
                                      reorder(d.chapters[ci].lessons, li, 1),
                                    )
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() =>
                                    remove(() =>
                                      edit((d) => {
                                        d.chapters[ci].lessons.splice(li, 1);
                                      }),
                                    )
                                  }
                                >
                                  移除课时
                                </button>
                              </div>
                              {l.segments.map((s, si) => (
                                <div className="studio-segment-row" key={s.id}>
                                  <button
                                    className={
                                      selected === s.id ? 'is-active' : ''
                                    }
                                    onClick={() => setSelected(s.id)}
                                  >
                                    {si + 1}. {s.title}
                                    <small>
                                      {s.videoId ? '已有视频' : '待配置'} ·{' '}
                                      {s.questions.length} 题
                                    </small>
                                  </button>
                                  <div className="studio-tiny-actions">
                                    <button
                                      title="上移片段"
                                      disabled={si === 0}
                                      onClick={() =>
                                        edit((d) =>
                                          reorder(
                                            d.chapters[ci].lessons[li].segments,
                                            si,
                                            -1,
                                          ),
                                        )
                                      }
                                    >
                                      ↑
                                    </button>
                                    <button
                                      title="下移片段"
                                      disabled={si === l.segments.length - 1}
                                      onClick={() =>
                                        edit((d) =>
                                          reorder(
                                            d.chapters[ci].lessons[li].segments,
                                            si,
                                            1,
                                          ),
                                        )
                                      }
                                    >
                                      ↓
                                    </button>
                                    <button
                                      title="移除片段"
                                      onClick={() =>
                                        remove(() =>
                                          edit((d) => {
                                            d.chapters[ci].lessons[
                                              li
                                            ].segments.splice(si, 1);
                                          }),
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                className="studio-add"
                                onClick={() => {
                                  const s = emptySegment();
                                  edit((d) =>
                                    d.chapters[ci].lessons[li].segments.push(s),
                                  );
                                  setSelected(s.id);
                                }}
                              >
                                ＋ 学习片段
                              </button>
                            </div>
                          ))}
                          <button
                            className="studio-add"
                            onClick={() =>
                              edit((d) =>
                                d.chapters[ci].lessons.push({
                                  id: crypto.randomUUID(),
                                  title: '新课时',
                                  segments: [],
                                }),
                              )
                            }
                          >
                            ＋ 课时
                          </button>
                        </div>
                      ))}
                      <button className="studio-add" onClick={addChapter}>
                        ＋ 添加章节
                      </button>
                    </section>
                    <section className="studio-fields">
                      <fieldset disabled={locked}>
                        {!selectedSegment ? (
                          <>
                            <h3>课程基本信息</h3>
                            <label>学科<select value={course.draft.subject ?? '数学'} onChange={e => edit(d => { d.subject = e.target.value; })}><option>数学</option><option>物理</option><option>化学</option></select></label>
                            <label>年级<select value={course.draft.grade ?? '初一'} onChange={e => edit(d => { d.grade = e.target.value; })}><option>初一</option><option>初二</option><option>初三</option></select></label>
                            <label>
                              课程名称
                              <input
                                maxLength={100}
                                value={course.draft.title}
                                onChange={(e) =>
                                  edit((d) => {
                                    d.title = e.target.value;
                                  })
                                }
                              />
                            </label>
                            <label>
                              课程介绍
                              <textarea
                                rows={4}
                                maxLength={2000}
                                value={course.draft.description}
                                onChange={(e) =>
                                  edit((d) => {
                                    d.description = e.target.value;
                                  })
                                }
                                placeholder="这门课适合谁，学完后可以做什么？"
                              />
                            </label>
                            <label>
                              课程封面
                              <select
                                value={course.draft.coverId}
                                onChange={(e) =>
                                  edit((d) => {
                                    d.coverId = e.target.value;
                                  })
                                }
                              >
                                <option value="">暂不设置封面</option>
                                {assets
                                  .filter((a) => a.mime.startsWith('image/'))
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            {course.draft.coverId && (
                              <img
                                className="studio-cover"
                                src={assetUrl(course.draft.coverId)}
                                alt="课程封面预览"
                              />
                            )}
                            <p className="studio-muted">
                              在左侧添加章节和课时，再为每个课时添加学习片段。
                            </p>
                          </>
                        ) : (
                          <>
                            <h3>学习片段</h3>
                            <label>
                              片段名称
                              <input
                                maxLength={100}
                                value={selectedSegment.title}
                                onChange={(e) =>
                                  editSegment({ title: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              学习目标
                              <textarea
                                maxLength={1000}
                                rows={2}
                                value={selectedSegment.goal}
                                onChange={(e) =>
                                  editSegment({ goal: e.target.value })
                                }
                                placeholder="例如：能说明绝对值为什么不能是负数"
                              />
                            </label>
                            <label>
                              本段视频
                              <select
                                value={selectedSegment.videoId}
                                onChange={(e) =>
                                  editSegment({ videoId: e.target.value })
                                }
                              >
                                <option value="">待上传视频</option>
                                {assets
                                  .filter((a) => a.mime.startsWith('video/'))
                                  .map((a) => (
                                    <option value={a.id} key={a.id}>
                                      {a.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={() => setView('assets')}
                            >
                              前往素材库上传视频
                            </button>
                            {selectedSegment.videoId && (
                              <video
                                className="studio-video"
                                controls
                                preload="metadata"
                                src={assetUrl(selectedSegment.videoId)}
                              />
                            )}
                            <label>
                              知识点 / 文字讲解
                              <textarea
                                rows={5}
                                maxLength={8000}
                                value={selectedSegment.notes}
                                onChange={(e) =>
                                  editSegment({ notes: e.target.value })
                                }
                                placeholder="学生可见的讲解内容，也作为 AI 反馈依据。"
                              />
                            </label>
                            <details className="studio-box">
                              <summary>AI 教学要求</summary>
                              <label>
                                常见错误
                                <textarea
                                  rows={3}
                                  maxLength={2000}
                                  value={selectedSegment.misconceptions}
                                  onChange={(e) =>
                                    editSegment({
                                      misconceptions: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                反馈要求
                                <textarea
                                  rows={3}
                                  maxLength={2000}
                                  value={selectedSegment.guidance}
                                  onChange={(e) =>
                                    editSegment({ guidance: e.target.value })
                                  }
                                  placeholder="例如：先指出符号问题，再让学生画数轴检查。"
                                />
                              </label>
                            </details>
                            <div className="studio-box">
                              <h4>学习规则</h4>
                              <label className="studio-check">
                                <input
                                  type="checkbox"
                                  checked={selectedSegment.videoRequired}
                                  onChange={(e) =>
                                    editSegment({
                                      videoRequired: e.target.checked,
                                    })
                                  }
                                />
                                需要看完视频
                              </label>
                              <label className="studio-check">
                                <input
                                  type="checkbox"
                                  checked={selectedSegment.allowSkip}
                                  onChange={(e) =>
                                    editSegment({ allowSkip: e.target.checked })
                                  }
                                />
                                允许学生跳过本段
                              </label>
                              <label>
                                题目完成规则
                                <select
                                  value={selectedSegment.completion}
                                  onChange={(e) =>
                                    editSegment({ completion: e.target.value })
                                  }
                                >
                                  <option value="submit">
                                    提交回答即可继续
                                  </option>
                                  <option value="correct">
                                    答对或订正后继续
                                  </option>
                                </select>
                              </label>
                              <p className="studio-muted">
                                AI
                                无法确定简答题时会标为“待确认”，允许学生对照参考答案后继续；跳过不代表掌握。
                              </p>
                            </div>
                            <h3>互动题 · {selectedSegment.questions.length}</h3>
                            {selectedSegment.questions.map((q, qi) => (
                              <div className="studio-question" key={q.id}>
                                <div className="studio-row">
                                  <strong>第 {qi + 1} 题</strong>
                                  <div className="studio-tiny-actions">
                                    <button
                                      disabled={qi === 0}
                                      onClick={() =>
                                        edit((d) =>
                                          reorder(
                                            flattenSegments(d).find(
                                              (s) => s.id === selected,
                                            )!.questions,
                                            qi,
                                            -1,
                                          ),
                                        )
                                      }
                                    >
                                      上移
                                    </button>
                                    <button
                                      disabled={
                                        qi ===
                                        selectedSegment.questions.length - 1
                                      }
                                      onClick={() =>
                                        edit((d) =>
                                          reorder(
                                            flattenSegments(d).find(
                                              (s) => s.id === selected,
                                            )!.questions,
                                            qi,
                                            1,
                                          ),
                                        )
                                      }
                                    >
                                      下移
                                    </button>
                                    <button
                                      onClick={() =>
                                        remove(() =>
                                          editSegment({
                                            questions:
                                              selectedSegment.questions.filter(
                                                (x) => x.id !== q.id,
                                              ),
                                          }),
                                        )
                                      }
                                    >
                                      移除
                                    </button>
                                  </div>
                                </div>
                                <label>
                                  题型
                                  <select
                                    value={q.type}
                                    onChange={(e) =>
                                      question(q.id, {
                                        type: e.target
                                          .value as StudioQuestion['type'],
                                        answer: '',
                                        options:
                                          e.target.value === 'choice'
                                            ? ['', '']
                                            : [],
                                      })
                                    }
                                  >
                                    <option value="choice">单项选择</option>
                                    <option value="boolean">判断题</option>
                                    <option value="short">
                                      简答题（AI 反馈）
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  题目
                                  <textarea
                                    rows={2}
                                    maxLength={2000}
                                    value={q.prompt}
                                    onChange={(e) =>
                                      question(q.id, { prompt: e.target.value })
                                    }
                                  />
                                </label>
                                {q.type === 'choice' && (
                                  <>
                                    {q.options.map((o, oi) => (
                                      <label key={oi}>
                                        选项 {oi + 1}
                                        <input
                                          maxLength={500}
                                          value={o}
                                          onChange={(e) =>
                                            question(q.id, {
                                              options: q.options.map((v, i) =>
                                                i === oi ? e.target.value : v,
                                              ),
                                            })
                                          }
                                        />
                                      </label>
                                    ))}
                                    <div className="studio-actions">
                                      <button
                                        disabled={q.options.length >= 6}
                                        onClick={() =>
                                          question(q.id, {
                                            options: [...q.options, ''],
                                          })
                                        }
                                      >
                                        ＋ 选项
                                      </button>
                                      <button
                                        disabled={q.options.length <= 2}
                                        onClick={() =>
                                          question(q.id, {
                                            options: q.options.slice(0, -1),
                                            answer: '',
                                          })
                                        }
                                      >
                                        移除末项
                                      </button>
                                    </div>
                                  </>
                                )}
                                <label>
                                  参考答案
                                  {q.type === 'short' ? (
                                    <textarea
                                      maxLength={2000}
                                      rows={3}
                                      value={q.answer}
                                      onChange={(e) =>
                                        question(q.id, {
                                          answer: e.target.value,
                                        })
                                      }
                                    />
                                  ) : (
                                    <select
                                      value={q.answer}
                                      onChange={(e) =>
                                        question(q.id, {
                                          answer: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="">请选择</option>
                                      {q.type === 'boolean' ? (
                                        <>
                                          <option value="true">正确</option>
                                          <option value="false">错误</option>
                                        </>
                                      ) : (
                                        q.options.map((_, i) => (
                                          <option key={i} value={String(i + 1)}>
                                            选项 {i + 1}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  )}
                                </label>
                                <label>
                                  答案解析
                                  <textarea
                                    maxLength={3000}
                                    rows={2}
                                    value={q.explanation}
                                    onChange={(e) =>
                                      question(q.id, {
                                        explanation: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                {q.type === 'short' && (
                                  <label>
                                    AI 评价标准
                                    <textarea
                                      maxLength={3000}
                                      rows={3}
                                      value={q.rubric}
                                      onChange={(e) =>
                                        question(q.id, {
                                          rubric: e.target.value,
                                        })
                                      }
                                      placeholder="哪些要点必须包含？哪些表述也可以接受？"
                                    />
                                  </label>
                                )}
                              </div>
                            ))}
                            <button
                              className="studio-add"
                              onClick={() =>
                                editSegment({
                                  questions: [
                                    ...selectedSegment.questions,
                                    {
                                      id: crypto.randomUUID(),
                                      type: 'choice',
                                      prompt: '',
                                      options: ['', ''],
                                      answer: '',
                                      explanation: '',
                                      rubric: '',
                                    },
                                  ],
                                })
                              }
                            >
                              ＋ 添加互动题
                            </button>
                          </>
                        )}
                      </fieldset>
                    </section>
                  </div>
                </>
              )}
              {view === 'preview' && (
                <>
                  <p className="studio-notice">
                    当前草稿预览 · 不保存学习记录、不调用 AI
                    评分。缺少视频的片段将显示占位提示。
                  </p>
                  <CourseStudy
                    key={JSON.stringify(course.draft)}
                    preview={studentDocument(course.draft)}
                  />
                </>
              )}
              {view === 'assets' && (
                <section className="studio-fields">
                  <h3>素材库</h3>
                  <p className="studio-muted">
                    上传后可以在多个课程中复用。更换视频请上传新文件，原视频会保留给历史课程版本。
                  </p>
                  <label className="studio-upload">
                    {upload === null
                      ? '选择视频或封面上传'
                      : upload === 100 ? '文件已发送，正在保存到素材库…' : `正在上传 ${upload}%`}
                    <input
                      disabled={locked}
                      type="file"
                      accept="video/mp4,video/webm,image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadFile(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {pendingUpload && upload === null && (
                    <button type="button" disabled={locked} onClick={() => void uploadFile(pendingUpload.file, true)}>
                      重试完成上传（保留已传分块）
                    </button>
                  )}
                  <p className="studio-muted">
                    MP4 / WebM，单个视频最多 100 MiB；图片最多 8 MiB。建议使用 H.264
                    + AAC 编码的 MP4。
                  </p>
                  {assets.length === 0 ? (
                    <div className="studio-empty">
                      <h3>还没有素材</h3>
                      <p>你可以先编排课程，录好视频后再回来上传。</p>
                    </div>
                  ) : (
                    <div className="studio-asset-grid">
                      {assets.map((a) => (
                        <article className="studio-box" key={a.id}>
                          {a.mime.startsWith('image/') ? (
                            <img
                              className="studio-cover"
                              src={assetUrl(a.id)}
                              alt={a.name}
                            />
                          ) : (
                            <div className="studio-asset-symbol">▶ 视频</div>
                          )}
                          <strong>{a.name}</strong>
                          <p>{(a.bytes / 1024 / 1024).toFixed(1)} MB</p>
                          <a
                            href={assetUrl(a.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            预览素材 ↗
                          </a>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {view === 'versions' && (
                <section className="studio-fields">
                  <h3>发布记录</h3>
                  <p>
                    恢复操作会生成可编辑草稿，检查后再次发布才会影响新学生。已开始的学习始终保留原版本。
                  </p>
                  {versions.length === 0 && (
                    <p className="studio-empty">尚未发布任何版本。</p>
                  )}
                  {versions.map((v) => (
                    <div className="studio-history" key={v.id}>
                      <div>
                        <strong>
                          {new Date(v.created_at).toLocaleString('zh-CN')}
                        </strong>
                        <p>
                          {v.id === course.published_version
                            ? '当前正式版本'
                            : '历史版本'}
                        </p>
                      </div>
                      <button
                        disabled={locked || dirty}
                        onClick={() =>
                          void task(async () => {
                            accept(
                              await api('/api/studio', {
                                action: 'restore',
                                id: course.id,
                                revision: course.revision,
                                version: v.id,
                              }),
                            );
                            setNotice('已恢复到草稿，请预览后重新发布。');
                          })
                        }
                      >
                        恢复为草稿
                      </button>
                    </div>
                  ))}
                  {course.published_version && (
                    <button
                      disabled={locked || dirty}
                      onClick={() => {
                        if (
                          confirm(
                            course.archived
                              ? '恢复课程访问？'
                              : '下架后学生将暂时无法打开这门课程，确定吗？',
                          )
                        )
                          void task(async () => {
                            accept(
                              await api('/api/studio', {
                                action: 'archive',
                                id: course.id,
                                revision: course.revision,
                                archived: !course.archived,
                              }),
                            );
                            await refreshList();
                          });
                      }}
                    >
                      {course.archived
                        ? '恢复课程访问'
                        : '下架课程（保留记录）'}
                    </button>
                  )}
                </section>
              )}
              {view === 'reports' && (
                <section className="studio-fields">
                  <h3>学习情况</h3>
                  <p className="studio-muted">
                    用学习者编号区分账号。完成或跳过片段不等于掌握知识；AI
                    评价供教学参考。
                  </p>
                  <div className="studio-actions">
                    <button
                      disabled={locked}
                      onClick={() => void showReports(reportPage)}
                    >
                      刷新记录
                    </button>
                    <button
                      onClick={() =>
                        exportJSON(
                          {
                            course: course.draft.title,
                            enrollments,
                            answers: reports,
                          },
                          '学习记录-当前页.json',
                        )
                      }
                    >
                      导出当前页
                    </button>
                    <button
                      disabled={reportPage === 0 || locked}
                      onClick={() => void showReports(reportPage - 1)}
                    >
                      上一页
                    </button>
                    <span>第 {reportPage + 1} 页</span>
                    <button
                      disabled={
                        locked ||
                        (reports.length < 100 && enrollments.length < 100)
                      }
                      onClick={() => void showReports(reportPage + 1)}
                    >
                      下一页
                    </button>
                  </div>
                  <h4>学习进度</h4>
                  {enrollments.length === 0 ? (
                    <p>暂时没有学生开始这门课程。</p>
                  ) : (
                    <div className="studio-table">
                      <table>
                        <thead>
                          <tr>
                            <th>学习者编号</th>
                            <th>学生姓名</th>
                            <th>完成片段</th>
                            <th>最近学习</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollments.map((e) => (
                            <tr key={e.learner}>
                              <td title={e.learner}>{e.learner.slice(0, 8)}</td>
                              <td>{e.studentName || '未设置'}</td>
                              <td>{e.completed}</td>
                              <td>
                                {new Date(e.updated_at).toLocaleString('zh-CN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <h4>回答与反馈</h4>
                  {reports.length === 0 ? (
                    <p>还没有答题记录。</p>
                  ) : (
                    reports.map((r, i) => (
                      <article className="studio-question" key={i}>
                        <small>
                          学习者 {r.learner.slice(0, 8)} ·{' '}
                          {new Date(r.created_at).toLocaleString('zh-CN')} ·{' '}
                          {r.source === 'ai'
                            ? 'AI 评价'
                            : r.source === 'rule'
                              ? '规则判分'
                              : '参考反馈'}
                        </small>
                        <h4>
                          {r.segmentTitle} · {r.questionTitle}
                        </h4>
                        <p className="studio-pre">回答：{r.answer}</p>
                        <p className="studio-pre">{r.feedback || '正在评价'}</p>
                        <strong>
                          {r.correct === null
                            ? '待确认'
                            : r.correct
                              ? '正确'
                              : '需要订正'}
                        </strong>
                      </article>
                    ))
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
