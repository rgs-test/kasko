# Полис-оферта КАСКО — макет с вариативностью

Исходники макета полиса-оферты КАСКО ПАО СК «Росгосстрах» (основной продукт и «Коробка-конструктор»).

## Структура

- `project/canvas.json` — расположение артбордов по страницам (Page 1–7), заголовки групп.
- `project/*.dc.html` — артборды. Каждый файл — HTML-разметка + блок `<script type="text/x-dc">` с логикой (`renderVals`) и параметрами вариативности (`data-props`).
  - Страницы документа: `Main` (стр. 1), `Page2`–`Page6`; «Коробка-конструктор»: `Box-P1`–`Box-P6`.
  - Компоненты разделов: `Holder`, `Owner`, `Vehicle`, `Drivers`, `Coverage`, `Payment`, `Settlement`, `Beneficiary`, `Pledge`, `Territory`, `Termination`, `Inspection`, `Other`, `Annexes`, `ServiceInfo`, `Signatures`, `Terms`; для «Коробки» — `Box-*`.
  - Варианты (обертки компонента с заданными параметрами): `Holder-UL`, `Cov-Minimal`, `Pay-Inst-4`, `Box-Cov-All` и т. п.
  - Сноски на полях: `Note-*`.

## Синтаксис шаблонов

- `{{name}}` — значение из `renderVals()`.
- `<sc-if value="{{flag}}">…</sc-if>` — условный вывод.
- `<sc-for list="{{rows}}" as="r">…</sc-for>` — повтор.
- `<dc-import name="Coverage" v2="true">` — вставка компонента с параметрами (kebab-case → camelCase).

## Просмотр в браузере

`index.html` + `runtime.js` — самостоятельный прототип: движок читает `project/*.dc.html`, подставляет значения и обрабатывает переключатели (чекбоксы в документе работают так же, как на холсте).

- `#doc-kasko` — КАСКО целиком (стр. 1–6), `#doc-box` — «Коробка-конструктор» целиком;
- `#<имя артборда>` — отдельный компонент или вариант, например `#Cov-Minimal`.

Локально: `python3 -m http.server` в корне репозитория и открыть http://localhost:8000 (через `file://` не работает — нужен веб-сервер).
На GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.
