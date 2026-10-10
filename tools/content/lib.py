"""Authoring helper: L() builds one lesson dict. Outputs of examples and expected
outputs of exercise tests are computed by really running the code (generate_lessons.py)."""
MODULES = [
    ("m1", "Асосҳои Python", 1, 8),
    ("m2", "Операторҳо ва сатрҳо", 9, 14),
    ("m3", "Шартҳо ва давраҳо", 15, 20),
    ("m4", "Сохторҳои маълумот", 21, 26),
    ("m5", "Функсияҳо", 27, 31),
    ("m6", "Python-и миёна", 32, 36),
    ("m7", "Барномасозии объектӣ (OOP)", 37, 40),
    ("m8", "Муқаддимаи пешрафта", 41, 42),
]


def module_of(n):
    for mid, _t, a, b in MODULES:
        if a <= n <= b:
            return mid
    raise ValueError(n)


def L(n, title, desc, obj, exp, ex, notes, mist, task, quiz):
    """ex: [(title, code, stdin|None, steps)]
    task: (prompt, starter, solution, [stdin,...], hint, [mustContain...])
    quiz: [(question, [options], answerIndex, explanation)]"""
    assert len(quiz) >= 3, n
    assert len(ex) >= 1, n
    return {
        "schema": 1, "id": "lesson-%03d" % n, "number": n, "module": module_of(n),
        "title": title, "description": desc, "version": 1, "points": 20,
        "objectives": obj, "explanation": exp,
        "examples": [{"title": t, "code": c, "stdin": s or "", "steps": st} for t, c, s, st in ex],
        "notes": notes, "mistakes": mist,
        "exercise": {"prompt": task[0], "starter": task[1], "solution": task[2],
                     "tests": [{"stdin": s} for s in task[3]], "hint": task[4],
                     "mustContain": task[5]},
        "quiz": [{"q": q, "options": o, "answer": a, "explanation": e} for q, o, a, e in quiz],
    }
