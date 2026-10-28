"""Milestone 2 standalone frontend: replace numeric session ratings with written reviews.
Run from the cloned standalone repository: python path/to/apply_written_reviews.py
Makes .review-backup copies. Stops rather than silently modifying unexpected source.
"""
from pathlib import Path
import sys
ROOT = Path.cwd()
if not (ROOT/'src/demo/service.js').is_file():
    sys.exit('Run this from the root of your standalone React frontend repository.')
updates={}
def load(path): return (ROOT/path).read_text(encoding='utf-8')
def replace(s, old, new, path, count=1):
    actual=s.count(old)
    if actual!=count: raise RuntimeError(f'{path}: expected {count} occurrence(s), found {actual}: {old[:80]!r}')
    return s.replace(old,new)
def edit(path, fn):
    s=load(path); updates[path]=fn(s)

# Review form: textual review required, no star input.
def dialogs(s):
    p='src/components/dialogs.jsx'
    s=replace(s, 'Loading, RatingInput, StatusBadge', 'Loading, StatusBadge',p)
    s=replace(s,"  const [rating, setRating] = useState(0);\n",'',p)
    s=replace(s,"if (show) { setRating(0); setComments(''); setBusy(false); setError(null); }","if (show) { setComments(''); setBusy(false); setError(null); }",p)
    s=replace(s,"if (!rating) { setError({ message: 'Choose a rating from 1 to 5.' }); return; }","if (comments.trim().length < 10) { setError({ message: 'Please write at least 10 characters about the mentoring session.' }); return; }",p)
    s=replace(s,"{ rating, comments: comments.trim() || null }","{ comments: comments.trim() }",p)
    s=replace(s,'<Modal.Title>Rate this session</Modal.Title>','<Modal.Title>Write a session review</Modal.Title>',p)
    s=replace(s,'''          <Form.Group className="mb-3">
            <Form.Label>How was the session?</Form.Label>
            <RatingInput value={rating} onChange={setRating} />
          </Form.Group>
''','',p)
    s=replace(s,'Comments <span className="text-muted fw-normal">(optional)</span>','Your written review <span className="text-muted fw-normal">(required)</span>',p)
    s=replace(s,'placeholder="What went well? What could be better?"','placeholder="What guidance did you receive? What progress or next steps resulted from this session?"',p)
    s=replace(s,'Feedback is visible to the other participant and to administrators.','Reviews are visible to the mentoring participants and programme administrators for progress follow-up. This is sample data for the Milestone 2 demo.',p)
    s=replace(s,'disabled={busy || !rating}','disabled={busy || comments.trim().length < 10}',p)
    s=replace(s,'Submit feedback','Submit review',p)
    return s
edit('src/components/dialogs.jsx',dialogs)

def student(s):
    p='src/pages/student.jsx'
    s=replace(s,'LEVEL_LABEL, Stars, StatusBadge','LEVEL_LABEL, StatusBadge',p)
    s=replace(s,'''              {data.rating ? (
                <div className="text-end">
                  <Stars value={data.rating.average} count={data.rating.count} />
                </div>
              ) : (
                <span className="small text-muted">Not enough ratings yet</span>
              )}''','''              <span className="small text-muted">{data.review_count || 0} written session review{data.review_count === 1 ? '' : 's'}</span>''',p)
    s=replace(s,'Rate session</Button>','Write review</Button>',p)
    s=replace(s,'{own && <Chip>Rated {own.rating}/5</Chip>}','{own && <Chip>Review submitted</Chip>}',p)
    s=replace(s,'Your feedback</div>','Your review</div>',p)
    s=replace(s,"Thank you — your feedback was recorded.","Thank you — your review was recorded.",p)
    return s
edit('src/pages/student.jsx',student)

def ui(s):
    p='src/components/ui.jsx'
    start=s.index('/* ------------------------------------------------------------------ ratings */')
    end=s.index('/* ------------------------------------------------------------------ forms */',start)
    return s[:start]+s[end:]
edit('src/components/ui.jsx',ui)

def mentor(s):
    p='src/pages/mentor.jsx'
    s=replace(s,'''            label="Average rating"
            value={data?.rating_summary ? data.rating_summary.average.toFixed(1) : '—'}
            hint={data?.rating_summary ? `${data.rating_summary.count} ratings` : 'Shown after 3 ratings'}''','''            label="Student reviews"
            value={data?.review_summary?.count ?? 0}
            hint="Written reviews from completed sessions"''',p)
    s=replace(s,'''          <Panel title="Reputation" className="mt-3">
            {data?.rating_summary ? (
              <>
                <div className="d-flex align-items-baseline gap-2">
                  <span className="stat-value">{data.rating_summary.average.toFixed(1)}</span>
                  <span className="text-muted">/ 5</span>
                </div>
                <div className="small text-muted">{data.rating_summary.count} ratings from completed sessions</div>
              </>
            ) : (
              <p className="text-muted small mb-0">
                Ratings appear after at least three completed sessions have been rated. Feedback is visible to
                you and to administrators.
              </p>
            )}
          </Panel>''','''          <Panel title="Student reviews" className="mt-3">
            <div className="stat-value">{data?.review_summary?.count ?? 0}</div>
            <p className="text-muted small mb-0">Written session reviews help students, mentors and administrators follow the mentoring journey.</p>
          </Panel>''',p)
    s=replace(s,'>Rate</Button>','>Write review</Button>',p,2)
    s=replace(s,'<Chip>Rated</Chip>','<Chip>Reviewed</Chip>',p)
    s=replace(s,"toast.success('Feedback recorded.')","toast.success('Review recorded.')",p,2)
    return s
edit('src/pages/mentor.jsx',mentor)

def views(s):
    p='src/demo/views.js'
    a=s.index('  const rating = (id) => {');b=s.index('  const studentProfile = (id) => {',a)
    s=s[:a]+'''  const reviewCount = (id) => {
    const ids = d().sessions.filter((row) => row.mentor_id === id).map((row) => row.session_id);
    return d().feedback.filter((row) => ids.includes(row.session_id) && user(row.submitted_by)?.role === 'student' && row.comments?.trim()).length;
  };
'''+s[b:]
    s=replace(s,'rating: rating(id),','review_count: reviewCount(id),',p)
    s=replace(s,'rating_summary: rating(viewer.user_id)','review_summary: { count: reviewCount(viewer.user_id) }',p)
    s=replace(s,'feedback, rating,','feedback, reviewCount,',p)
    return s
edit('src/demo/views.js',views)

def service(s):
    p='src/demo/service.js'
    s=replace(s,"if (params.sort === 'rating_desc') rows.sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));","if (params.sort === 'rating_desc' || params.sort === 'reviews_desc') rows.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));",p)
    s=replace(s,"'Rate a completed sample session within 14 days.'","'Review a completed sample session within 14 days.'",p)
    s=replace(s,"        if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) invalid('rating', 'Choose a whole number from 1 to 5.');\n        if (body.comments) length(body.comments, 'comments', 0, 1000);","        length((body.comments || '').trim(), 'comments', 10, 1000);",p)
    s=replace(s,"'You have already rated this sample session.'","'You have already reviewed this sample session.'",p)
    s=replace(s,'rating: body.rating, comments: body.comments || null','comments: body.comments.trim()',p)
    s=replace(s,"'sessions_completed', 'average_rating'","'sessions_completed', 'review_count'",p)
    s=replace(s,"average_rating: v.rating(row.mentor_id)?.average ?? ''","review_count: v.reviewCount(row.mentor_id)",p)
    return s
edit('src/demo/service.js',service)

def analytics(s):
    p='src/demo/analytics.js'
    old="""      feedback: { count: feedback.length, average_rating: feedback.length ? feedback.reduce((sum, row) => sum + row.rating, 0) / feedback.length : null,
        rating_distribution: Object.fromEntries([1, 2, 3, 4, 5].map((rating) => [String(rating), feedback.filter((row) => row.rating === rating).length])) },"""
    new="""      feedback: { count: feedback.filter((row) => row.comments?.trim()).length,
        recent_reviews: feedback.filter((row) => row.comments?.trim() && d.users.some((u) => u.user_id === row.submitted_by && u.role === 'student'))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20).map((row) => {
            const session = d.sessions.find((s) => s.session_id === row.session_id);
            return { feedback_id: row.feedback_id, student_name: d.users.find((u) => u.user_id === row.submitted_by)?.full_name || 'Student',
              mentor_name: d.users.find((u) => u.user_id === session?.mentor_id)?.full_name || 'Mentor',
              session_date: session?.scheduled_start, comments: row.comments, created_at: row.created_at };
          }) },"""
    s=replace(s,old,new,p)
    s=replace(s,"        case 'avg_rating': rows = d.feedback.filter((row) => inBucket(row)); break;","        case 'reviews': rows = d.feedback.filter((row) => inBucket(row) && row.comments?.trim()); break;",p)
    s=replace(s,"params.metric === 'avg_rating' ? (rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null) : rows.length","rows.length",p)
    return s
edit('src/demo/analytics.js',analytics)

def admin(s):
    p='src/pages/admin.jsx'
    block='''            label="Average rating"
            value={overview.loading ? '—' : (data?.feedback?.average_rating != null ? data.feedback.average_rating.toFixed(2) : '—')}
            hint={data ? `${data.feedback.count} ratings in period` : '—'}'''
    s=replace(s,block,'''            label="Written reviews"
            value={overview.loading ? '—' : data?.feedback?.count ?? 0}
            hint="Session reviews in this period"''',p)
    s=replace(s,'<Col sm={6}><div className="small-label">Rating</div><div>{selected.rating ? `${selected.rating.average.toFixed(1)} / 5 (${selected.rating.count})` : \'No ratings yet\'}</div></Col>', '<Col sm={6}><div className="small-label">Student reviews</div><div>{selected.review_count || 0} written session reviews</div></Col>',p)
    s=replace(s,'''  const distribution = data?.feedback?.rating_distribution || {};
  const distributionMax = Math.max(1, ...Object.values(distribution).map((value) => Number(value) || 0));''','''  const recentReviews = data?.feedback?.recent_reviews || [];''',p)
    s=replace(s,'''            label="Average rating"
            value={overview.loading ? '—' : (data?.feedback?.average_rating != null ? data.feedback.average_rating.toFixed(2) : '—')}
            hint={data ? `${data.feedback.count} ratings` : '—'}''','''            label="Written reviews"
            value={overview.loading ? '—' : data?.feedback?.count ?? 0}
            hint="Reviews submitted in the period"''',p)
    s=replace(s,'Requests through to rated sessions in the selected period.','Requests through to reviewed sessions in the selected period.',p)
    start=s.index('          <Panel title="Rating distribution"');end=s.index('          </Panel>',start)+len('          </Panel>')
    s=s[:start]+'''          <Panel title="Student session reviews" className="mt-3" subtitle="Written student reflections help administrators follow mentoring progress in this local demo.">
            {overview.loading && <Loading label="Loading reviews…" rows={3} />}
            {!overview.loading && !overview.error && (
              recentReviews.length === 0
                ? <EmptyState icon="◇" title="No written student reviews in this period" />
                : <div className="d-grid gap-3">
                  {recentReviews.map((review) => (
                    <div className="note-box" key={review.feedback_id}>
                      <div className="fw-semibold">{review.student_name} · Mentor: {review.mentor_name}</div>
                      <div className="small text-muted mb-2">Session: {review.session_date ? fmtDateTime(review.session_date) : 'Not recorded'}</div>
                      <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{review.comments}</div>
                    </div>
                  ))}
                </div>
            )}
          </Panel>'''+s[end:]
    s=replace(s,'Analytics show aggregate counts. Groups smaller than five are suppressed, and no free-text feedback or\n              personal contact details appear in reports. Access is limited to administrators and every export is\n              audit-logged.','Analytics summary statistics are aggregate. Administrators can read the written student session reviews above\n              for mentoring follow-up. Free-text review content is not included in CSV exports. This is a local demo;\n              real deployment requires an approved privacy and access-control policy.',p)
    return s
edit('src/pages/admin.jsx',admin)

def fixtures(s):
    p='src/demo/fixtures.js'
    s=replace(s,"rating: 5, comments: 'Sample feedback: the next steps were clear.'","comments: 'We reviewed my portfolio and identified two specific improvements for my project README. My next step is updating the documentation before our next session.'",p)
    return s
edit('src/demo/fixtures.js',fixtures)

def tests(s):
    p='tests/demo.test.js'
    s=replace(s,"{ rating: 4, comments: 'Sample feedback.' }","{ comments: 'The mentor helped me plan two concrete portfolio improvements.' }",p)
    s=replace(s,"{ rating: 4 }","{ comments: 'Another written review attempt.' }",p)
    s=replace(s,"assert.equal((await req('GET', '/sessions/session-rateable/feedback')).data[0].rating, 4);","assert.match((await req('GET', '/sessions/session-rateable/feedback')).data[0].comments, /portfolio improvements/);",p)
    s=replace(s,"assert.equal((await req('GET', '/mentors/mentor-demo')).data.rating.average, 4.5);","assert.equal((await req('GET', '/mentors/mentor-demo')).data.review_count, 2);",p)
    return s
edit('tests/demo.test.js',tests)

def readme(s):
    p='README.md'
    s=replace(s,'One rating per participant per completed session within the demo 14-day window, local comments and recalculated ratings.','One required written review per participant per completed session within the demo 14-day window. Admin analytics can display recent student review text and review counts.',p)
    return s
edit('README.md',readme)

if '--check' in sys.argv:
    print('All', len(updates), 'source transformations matched. No files modified.')
else:
    for path,s in updates.items():
        f=ROOT/path
        backup=f.with_name(f.name+'.review-backup')
        backup.write_text(f.read_text(encoding='utf-8'),encoding='utf-8')
        f.write_text(s,encoding='utf-8')
    print('Updated:',', '.join(updates))
    print('Backups created with .review-backup suffix. Run npm test and npm run build.')
