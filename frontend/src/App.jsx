import { useEffect, useState } from 'react'

export default function App() {
  const [products, setProducts] = useState([])
  const [vectors, setVectors] = useState([])
  const [productError, setProductError] = useState('')
  const [vectorError, setVectorError] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [aiError, setAiError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  async function askAI(event) {
    event.preventDefault()
    if (!question.trim() || aiLoading) return

    setAiLoading(true)
    setAnswer('')
    setAiError('')

    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() })
      })

      if (!response.ok) throw new Error('HTTP ' + response.status)

      const data = await response.json()
      setAnswer(data.answer)
    } catch (error) {
      setAiError(error.message)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/products')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
      .then(setProducts)
      .catch(error => setProductError(error.message))

    fetch('/api/vector-search')
      .then(response => {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.json()
      })
      .then(setVectors)
      .catch(error => setVectorError(error.message))
  }, [])

  return (
    <main style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff'
    }}>
      <h1>상품 관리 및 벡터 검색 연습</h1>
      <p>React + FastAPI + MySQL + PostgreSQL</p>

      <section style={{ marginTop: '40px' }}>
        <h2>MySQL 상품 목록</h2>
        {productError && <p>오류: {productError}</p>}
        <table style={{ width: '100%', textAlign: 'center' }}>
          <thead>
            <tr>
              <th>번호</th>
              <th>상품명</th>
              <th>가격</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.price.toLocaleString('ko-KR')}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: '50px' }}>
        <h2>PostgreSQL 벡터 유사도 검색</h2>
        <p>검색 기준 벡터: [1, 0, 0]</p>
        {vectorError && <p>오류: {vectorError}</p>}
        <table style={{ width: '100%', textAlign: 'center' }}>
          <thead>
            <tr>
              <th>순위</th>
              <th>이름</th>
              <th>거리</th>
            </tr>
          </thead>
          <tbody>
            {vectors.map((item, index) => (
              <tr key={item.name}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td>{item.distance.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>거리값이 작을수록 벡터가 유사합니다.</p>
      </section>
      <section style={{ marginTop: '50px' }}>
        <h2>Ollama 로컬 AI 질문하기</h2>
        <p>AI 모델: gemma3:270m</p>
        <form onSubmit={askAI}>
          <input
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="AI에게 질문을 입력하세요"
            maxLength={500}
            style={{
              width: '75%',
              padding: 12,
              marginRight: 10,
              borderRadius: 6
            }}
          />
          <button type="submit" disabled={aiLoading}>
            {aiLoading ? '답변 생성 중...' : '질문하기'}
          </button>
        </form>
        {aiError && <p role="alert">AI 연결 오류: {aiError}</p>}
        {answer && (
          <div style={{
            marginTop: 20,
            padding: 20,
            background: '#272733',
            borderRadius: 10,
            whiteSpace: 'pre-wrap'
          }}>
            <strong>AI 답변</strong>
            <p>{answer}</p>
          </div>
        )}
      </section>
    </main>
  )
}
