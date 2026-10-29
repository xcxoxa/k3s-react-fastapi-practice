import os
from fastapi import FastAPI

app = FastAPI(title="Backend Practice API")


@app.get("/")
def home():
    return {
        "message": "FastAPI server is running",
        "server": "k8s-worker1"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/products")
def get_products():
    import psycopg2

    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME", "practice_vector_db"),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        connect_timeout=10
    )

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, price FROM products ORDER BY id"
            )
            return [
                {"id": row[0], "name": row[1], "price": row[2]}
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@app.get("/vector-search")
def vector_search():
    import psycopg2
    from fastapi import HTTPException

    try:
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME", "practice_vector_db"),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            host=os.environ["DB_HOST"],
            port=int(os.getenv("DB_PORT", "5432")),
            connect_timeout=10
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT name,
                           ROUND((embedding <=> %s::vector)::numeric, 4)
                    FROM practice_vectors
                    ORDER BY embedding <=> %s::vector
                """, ("[1,0,0]", "[1,0,0]"))

                return [
                    {"name": name, "distance": float(distance)}
                    for name, distance in cursor.fetchall()
                ]
        finally:
            conn.close()
    except psycopg2.Error:
        raise HTTPException(
            status_code=500,
            detail="Vector database query failed"
        )


from pydantic import BaseModel
from fastapi import HTTPException
import json
import urllib.request
import urllib.error


class AIQuestion(BaseModel):
    question: str


@app.post("/ai/ask")
def ask_ai(data: AIQuestion):
    question = data.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")

    if len(question) > 500:
        raise HTTPException(status_code=400, detail="Question is too long")

    payload = json.dumps({
        "model": os.getenv("OLLAMA_MODEL", "gemma3:270m"),
        "prompt": question,
        "stream": False,
        "options": {"num_predict": 120}
    }).encode("utf-8")

    request = urllib.request.Request(
        os.environ["OLLAMA_URL"].rstrip("/") + "/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.load(response)

        return {
            "model": result.get("model"),
            "answer": result.get("response", "")
        }

    except (urllib.error.URLError, TimeoutError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable"
        )
