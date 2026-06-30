import psycopg2.extras
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn_params = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT"))
}

def execute_query(query, params=None, number_result=None):
    result = [] 
    try:
        with psycopg2.connect(**conn_params) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                if cur.description:
                    if number_result is None:
                        result = cur.fetchall()
                    elif number_result == 1:
                        result = cur.fetchone()
                    else:
                        result = cur.fetchmany(number_result)
    except Exception as e:
        print(f"❌ Erreur SQL : {e}")
        return False
        
    return result
