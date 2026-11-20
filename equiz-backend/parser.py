import re
from docx import Document


def parse_universal_equiz(file_path: str) -> list[dict]:
    doc = Document(file_path)
    quiz_data: list[dict] = []

    current_question_text: list[str] = []
    current_options: dict[str, str] = {}
    current_correct: str | None = None

    def save_current_question() -> None:
        nonlocal current_question_text, current_options, current_correct
        if current_question_text and len(current_options) >= 2:
            correct_keys = (
                [current_correct]
                if current_correct and current_correct in current_options
                else []
            )
            quiz_data.append({
                "item_type": "mcq",
                "points": 1,
                "payload": {
                    "question": "\n".join(current_question_text).strip(),
                    "options": current_options.copy(),
                    "correct_keys": correct_keys,
                },
            })
        current_question_text.clear()
        current_options.clear()
        current_correct = None

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue

        # 1. Дұрыс жауапты анықтау
        if text.lower().startswith("дұрыс жауап"):
            if len(current_options) > 0:
                raw_ans = text.split(":", 1)[-1].strip().upper()
                # Кирилл әрпі кездессе латынға түрлендіру
                cyr_map = str.maketrans("АВСДЕ", "ABCDE")
                ans = raw_ans.translate(cyr_map)
                if len(ans) >= 1 and ans[0] in "ABCDE":
                    current_correct = ans[0]
            continue

        # Кириллица мен латын әріптерін нормализациялау (Д -> D қосылды)
        norm_text = text
        for cyr, lat in zip("АВСДЕТР", "ABCDETP"):
            norm_text = norm_text.replace(cyr + ")", lat + ")")

        # 2. Жолдың "жауап нұсқалары" екенін тексеру
        is_option_line = bool(re.search(r"(?:^|\s)[A-E]\)", norm_text))

        if is_option_line:
            if "A)" not in norm_text and bool(re.search(r"(?:^|\s)B\)", norm_text)) and len(current_options) == 0:
                parts = re.split(r"\s*B\)", norm_text, maxsplit=1)
                current_options["A"] = parts[0].strip()
                norm_text = "B)" + parts[1]

            matches = list(re.finditer(r"([A-E])\)", norm_text))
            if matches:
                for i in range(len(matches)):
                    letter = matches[i].group(1)
                    start_idx = matches[i].end()
                    end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(norm_text)
                    opt_text = norm_text[start_idx:end_idx].strip()
                    current_options[letter] = opt_text
            continue

        # 3. Сұрақ мәтіні
        if len(current_options) > 0:
            save_current_question()

        match = re.match(r"^\d+[\.\)]\s*(.*)", text)
        if match:
            clean_text = match.group(1).strip()
            if len(current_options) == 0:
                current_question_text.clear()
            if clean_text:
                current_question_text.append(clean_text)
        else:
            current_question_text.append(text)

    save_current_question()
    return quiz_data