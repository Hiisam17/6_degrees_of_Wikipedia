# Six Degrees (phiên bản chỉ giữa 2 người nổi tiếng) — Tổng quan & UML

Tài liệu này cung cấp cái nhìn toàn cảnh về dự án: mục tiêu, kiến trúc, luồng người dùng, luồng dữ liệu, và các sơ đồ UML minh họa (component, sequence, activity). Bạn có thể dùng tài liệu này làm 'bản đồ' khi code.

---

## 1. Mục tiêu ngắn gọn

- Tìm **đường ngắn nhất** giữa hai **người nổi tiếng** trên Wikipedia (chỉ qua các trang được xác nhận là _person_).
- Backend: Node.js + Express; Frontend: React (tùy chọn).
- Data sources: **Wikipedia API** (links, pageprops) + **Wikidata API** (xác nhận P31 = Q5).
- Thuật toán chính: **Bidirectional BFS** với batch lookups & cache.

---

## 2. Kiến trúc thành phần (Component overview)

- **Client (Frontend)**: Form nhập `from` & `to` → gọi API → hiển thị path + stats.
- **API Server (Backend)**

  - Endpoint: `POST /find-person-path`
  - Modules: utils (normalize/resolve), wiki client (getLinks, getLinksBulk), wikidata client (getWikibaseBulk, isPersonBulk), search (bidir bfs), cache layer (Redis/node-cache), throttle/queue.

- **External APIs**: Wikipedia REST/API, Wikidata API.
- **Optional**: Redis (cache), Offline graph DB (Neo4j / SQLite) cho scale.

---

## 3. Luồng người dùng (User flow)

1. Người dùng nhập hai tên người nổi tiếng trên giao diện và bấm `Tìm`.
2. Frontend gửi `POST /find-person-path` với body `{ from, to, maxDepth }`.
3. Backend:

   - Normalize & resolve redirect cho cả 2 trang.
   - Kiểm tra 2 trang có phải person (Wikidata) — nếu không, trả lỗi.
   - Chạy **bidirectional BFS**: mở rộng frontier nhỏ hơn, mỗi bước lấy links → batch lấy wikibase ids → batch kiểm tra isPerson → build next frontier.
   - Nếu hai frontier gặp nhau: reconstruct path và trả JSON kết quả.

4. Frontend hiển thị path (breadcrumb + link tới Wikipedia) và các thống kê (steps, elapsed_ms, nodes_explored, api_calls).

---

## 4. Luồng dữ liệu (Data flow)

- Input: `from`, `to` (text)
- Transforms:

  - normalizeTitle -> canonicalTitle (resolveRedirect)
  - getLinks(title) -> danh sách tiêu đề liên kết (cached)
  - getWikibaseItemsBulk(titles) -> title -> Qid
  - isPersonBulk(Qids) -> Qid -> boolean

- Output: `path: [Title...], steps, stats`

---

## 5. Endpoint API (tóm tắt)

- **POST /find-person-path**

  - Body: `{ from: string, to: string, maxDepth?: number }`
  - Success: `200 { path: [...], steps: N, elapsed_ms, stats: {...} }`
  - Error: 4xx nếu input invalid hoặc page missing

---

## 6. UML diagrams

> Dưới đây có các sơ đồ UML để minh họa — mình cung cấp cả PlantUML blocks để bạn có thể copy chạy trong PlantUML nếu muốn.

### 6.1 Component Diagram (PlantUML)

```plantuml
@startuml
package "Frontend" {
  [Web UI]
}
package "Backend" {
  [API Server]
  [WikiClient]
  [WikidataClient]
  [SearchService]
  [Cache (Redis)]
}
package "External" {
  [Wikipedia API]
  [Wikidata API]
}
[Web UI] --> [API Server] : POST /find-person-path
[API Server] --> [SearchService]
[SearchService] --> [WikiClient] : getLinks / getLinksBulk
[SearchService] --> [WikidataClient] : getWikibaseBulk / isPersonBulk
[SearchService] --> [Cache (Redis)] : check/set
[WikiClient] --> [Wikipedia API]
[WikidataClient] --> [Wikidata API]
@enduml
```

### 6.2 Sequence Diagram (PlantUML) — tìm path

```plantuml
@startuml
participant User
participant Frontend
participant API as "API Server"
participant Search as "SearchService"
participant Cache
participant Wiki as "Wikipedia API"
participant WD as "Wikidata API"

User -> Frontend : input(from, to)
Frontend -> API : POST /find-person-path
API -> Search : normalize & resolveRedirect
Search -> Cache : get(wikibase:<title>)
alt cache miss
  Search -> Wiki : query pageprops (get wikibase id)
  Search -> WD : check P31 == Q5
  WD --> Search : boolean
  Search -> Cache : set isPerson
end
Search -> Search : start bidir BFS
loop each iteration
  Search -> Cache : get(links:<title>)
  alt miss
    Search -> Wiki : get links (may use plcontinue)
    Wiki --> Search : links list
    Search -> Cache : set(links)
  end
  Search -> Search : batch getWikibase for neighbors
  Search -> WD : wbgetentities (batch)
  WD --> Search : claims
  Search -> Search : filter person neighbors
  Search -> Search : check intersection
end
Search --> API : result {path, stats}
API --> Frontend : 200 {path, stats}
Frontend --> User : show result
@enduml
```

### 6.3 Activity Diagram (simple)

```plantuml
@startuml
start
:Receive from/to;
:normalize & resolve redirects;
if (both pages exist?) then (yes)
  :verify both are person;
  if (both person?) then (yes)
    :bidir BFS with person-filter;
    if (path found?) then (yes)
      :return path;
    else (no)
      :return not found;
    endif
  else (no)
    :return error (not person);
  endif
else (no)
  :return error (page missing);
endif
stop
@enduml
```

---

## 7. Metrics & Observability (gợi ý)

- `api_calls_wikipedia`, `api_calls_wikidata` (counters)
- `cache_hit_links`, `cache_hit_person` (ratios)
- `nodes_explored_per_query`, `avg_elapsed_ms`
- Log trace cho queries chậm (>2s)

---

## 8. Next steps gợi ý

- Tạo skeleton repo & triển khai MVP theo tài liệu này.
- Thử vài queries, bật log để xem `api_calls` và `cache_hit_rate`.
- Nếu cache hit low / latency cao -> cân nhắc offline people-only graph.

---

_Bạn có thể mở rộng hoặc yêu cầu mình chỉnh sơ đồ UML (ví dụ thêm class diagram chi tiết cho modules, hoặc render PNG PlantUML)._
