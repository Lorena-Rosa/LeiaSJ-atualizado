import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Tabs, Tab } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Book,
  Users,
  Archive,
  AlertTriangle,
  Info,
  LogOut,
  User,
  Trash2,
  CheckCircle,
  PlusCircle,
  Pencil,
  X,
  Save,
  Search,
} from "lucide-react";

import "./Bibliotecario.css";

const K_BOOKS = "leiasj_books_v1";
const K_USERS = "leiasj_users_v1";
const K_LOANS = "leiasj_loans_v1";
const K_LOGGED = "leiasj_logged_user";
const K_NOTIFS = "leiasj_notifications_v1";

export default function Bibliotecario() {
  const navigate = useNavigate();

  // ===== Estado geral =====
  const [tab, setTab] = useState("livros");

  // Livros
  const [books, setBooks] = useState([]);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscaLivro, setBuscaLivro] = useState(""); // texto da busca

  // filtros da barra de pesquisa / catálogo
  const [filtroLivro, setFiltroLivro] = useState("todos"); // disponibilidade
  const [filtroGenero, setFiltroGenero] = useState("todos"); // gênero
  const [filtroAutor, setFiltroAutor] = useState("todos"); // autor

  const [novoLivro, setNovoLivro] = useState({
    titulo: "",
    autor: "",
    genero: "",
    quantidade: 1,
    capa: "",
  });

  // Edição de livro
  const [editId, setEditId] = useState(null);
  const [editBook, setEditBook] = useState({
    titulo: "",
    autor: "",
    genero: "",
    quantidade: 1,
    capa: "",
  });

  // Usuários
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");

  // Empréstimos
  const [emprestimos, setEmprestimos] = useState([]);

  // Sessão + Notificações
  const [bibliotecario, setBibliotecario] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const seenIdsRef = useRef(new Set());
  const audioRef = useRef(null);

  // ===== Helpers =====
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const addDaysISO = (startISO, days) => {
    const d = new Date(startISO);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const isAtrasado = (prazo) => prazo && prazo < todayISO();

  // ===== Init =====
  useEffect(() => {
    setBooks(JSON.parse(localStorage.getItem(K_BOOKS)) || []);
    setUsers(JSON.parse(localStorage.getItem(K_USERS)) || []);
    setEmprestimos(JSON.parse(localStorage.getItem(K_LOANS)) || []);
    setBibliotecario(JSON.parse(localStorage.getItem(K_LOGGED)) || null);
    setNotifs(JSON.parse(localStorage.getItem(K_NOTIFS)) || []);
  }, []);

  const sair = () => {
    if (window.confirm("Deseja realmente sair?")) {
      localStorage.removeItem(K_LOGGED);
      navigate("/login");
    }
  };

  // ===== Notificações =====
  const persistNotifs = useCallback((next) => {
    setNotifs(next);
    localStorage.setItem(K_NOTIFS, JSON.stringify(next));
  }, []);

  const pushNotif = useCallback(
    ({ type, text, refId }) => {
      const n = {
        id: Date.now() + Math.random().toString(36).slice(2),
        ts: new Date().toISOString(),
        type,
        text,
        read: false,
        refId: refId || null,
      };
      const next = [n, ...(JSON.parse(localStorage.getItem(K_NOTIFS)) || [])];
      persistNotifs(next);
      if (audioRef.current) audioRef.current.play();
    },
    [persistNotifs]
  );

  const markAllRead = useCallback(() => {
    const next = notifs.map((n) => ({ ...n, read: true }));
    persistNotifs(next);
  }, [notifs, persistNotifs]);

  const unreadCount = useMemo(
    () => notifs.filter((n) => !n.read).length,
    [notifs]
  );

  // ===== Verificação automática de empréstimos (novos/ prazos) =====
  const checkLoansAndNotify = useCallback(() => {
    const freshLoans = JSON.parse(localStorage.getItem(K_LOANS)) || [];
    setEmprestimos(freshLoans);

    freshLoans.forEach((e) => {
      if (e.status === "Pendente" && !seenIdsRef.current.has(e.id)) {
        seenIdsRef.current.add(e.id);
        pushNotif({
          type: "loan",
          text: `Novo pedido: ${e.livro?.titulo || "Livro"} por ${
            e.usuario?.nome || "Usuário"
          }`,
          refId: e.id,
        });
      }

      // Prazo próximo (<= 2 dias) alerta pro bibliotecário
      if (!e.devolvido && e.prazo) {
        const rest = Math.ceil(
          (new Date(e.prazo) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (rest <= 2 && rest >= 0) {
          const key = `near-${e.id}-${e.prazo}`;
          if (!seenIdsRef.current.has(key)) {
            seenIdsRef.current.add(key);
            pushNotif({
              type: "warning",
              text: `Prazo próximo (${rest} dia${rest === 1 ? "" : "s"}): ${
                e.livro?.titulo
              } — ${e.usuario?.nome}`,
              refId: e.id,
            });
          }
        }
      }
    });
  }, [pushNotif]);

  useEffect(() => {
    const interval = setInterval(checkLoansAndNotify, 5000);
    window.addEventListener("storage", checkLoansAndNotify);
    checkLoansAndNotify();
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", checkLoansAndNotify);
    };
  }, [checkLoansAndNotify]);

  // ===== Livros =====
  async function buscarNaAPI(e) {
    e.preventDefault();
    if (!termo.trim()) return;

    // 🗣️ Função para traduzir gêneros comuns
    const traduzirGenero = (genero) => {
      if (!genero) return "Gênero não definido";
      const mapa = {
        Fiction: "Ficção",
        Science: "Ciência",
        History: "História",
        Biography: "Biografia",
        Autobiography: "Autobiografia",
        Art: "Arte",
        Philosophy: "Filosofia",
        Computers: "Computação",
        Technology: "Tecnologia",
        Education: "Educação",
        Poetry: "Poesia",
        Drama: "Drama",
        Religion: "Religião",
        Business: "Negócios",
        "Comics & Graphic Novels": "Quadrinhos e Graphic Novels",
        "Juvenile Fiction": "Ficção Juvenil",
        "Juvenile Nonfiction": "Não Ficção Juvenil",
        "Self-Help": "Autoajuda",
        Psychology: "Psicologia",
        "Health & Fitness": "Saúde e Boa Forma",
        Medical: "Medicina",
        Cooking: "Culinária",
        Travel: "Viagem",
        "Sports & Recreation": "Esportes e Recreação",
        Nature: "Natureza",
        Animals: "Animais",
        "Social Science": "Ciências Sociais",
        "Political Science": "Ciência Política",
        Law: "Direito",
        Music: "Música",
        Photography: "Fotografia",
        Architecture: "Arquitetura",
        Design: "Design",
        "Performing Arts": "Artes Cênicas",
        "Foreign Language Study": "Estudo de Línguas Estrangeiras",
        "Language Arts & Disciplines": "Linguística e Comunicação",
        Mathematics: "Matemática",
        "Science Fiction": "Ficção Científica",
        Fantasy: "Fantasia",
        Horror: "Terror",
        Mystery: "Mistério",
        Thriller: "Suspense",
        Romance: "Romance",
        Adventure: "Aventura",
        Humor: "Humor",
        "True Crime": "Crime Real",
        "Family & Relationships": "Família e Relacionamentos",
        Gardening: "Jardinagem",
        "Crafts & Hobbies": "Artesanato e Passatempos",
        "House & Home": "Casa e Lar",
        Transportation: "Transporte",
        Reference: "Referência",
        "Study Aids": "Guias de Estudo",
        "Body, Mind & Spirit": "Corpo, Mente e Espírito",
        "Antiques & Collectibles": "Antiguidades e Colecionáveis",
        "Literary Criticism": "Crítica Literária",
        "Games & Activities": "Jogos e Atividades",
        "Foreign Language": "Idioma Estrangeiro",
        Political: "Político",
        Cultural: "Cultural",
        Erotica: "Erótico",
        War: "Guerra",
        Western: "Faroeste",
        Mythology: "Mitologia",
        Folklore: "Folclore",
        Essays: "Ensaios",
        Satire: "Sátira",
        "Short Stories": "Contos",
        Epic: "Épico",
        Memoir: "Memórias",
      };

      return mapa[genero] || genero;
    };

    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          termo
        )}`
      );
      const data = await res.json();
      const itens =
        data.items?.map((item) => ({
          id: item.id,
          titulo: item.volumeInfo.title || "Sem título",
          autor: item.volumeInfo.authors?.join(", ") || "Autor desconhecido",
          genero: traduzirGenero(item.volumeInfo.categories?.[0]),
          capa:
            item.volumeInfo.imageLinks?.thumbnail ||
            item.volumeInfo.imageLinks?.smallThumbnail ||
            "",
          quantidade: 1,
        })) || [];
      setResultados(itens);
    } catch {
      alert("Erro ao buscar livros na API.");
    }
  }

  const adicionarLivroManual = (e) => {
    e.preventDefault();
    if (!novoLivro.titulo || !novoLivro.autor)
      return alert("Preencha ao menos Título e Autor.");
    const livro = {
      ...novoLivro,
      id: Date.now(),
      quantidade: Number(novoLivro.quantidade) || 1,
    };
    const updated = [...books, livro];
    setBooks(updated);
    localStorage.setItem(K_BOOKS, JSON.stringify(updated));
    setNovoLivro({
      titulo: "",
      autor: "",
      genero: "",
      quantidade: 1,
      capa: "",
    });
  };

  const adicionarLivroAPI = (livro) => {
    const novo = { ...livro, id: Date.now() };
    const updated = [...books, novo];
    setBooks(updated);
    localStorage.setItem(K_BOOKS, JSON.stringify(updated));
  };

  const excluirLivro = (id) => {
    if (!window.confirm("Excluir este livro?")) return;
    const updated = books.filter((b) => b.id !== id);
    setBooks(updated);
    localStorage.setItem(K_BOOKS, JSON.stringify(updated));
  };

  // Edição completa do livro
  const startEditBook = (b) => {
    setEditId(b.id);
    setEditBook({
      titulo: b.titulo || "",
      autor: b.autor || "",
      genero: b.genero || "",
      quantidade: Number(b.quantidade || 1),
      capa: b.capa || "",
    });
  };

  const cancelEditBook = () => {
    setEditId(null);
    setEditBook({
      titulo: "",
      autor: "",
      genero: "",
      quantidade: 1,
      capa: "",
    });
  };

  const saveEditBook = () => {
    if (!editBook.titulo || !editBook.autor)
      return alert("Preencha ao menos Título e Autor.");
    const updated = books.map((b) =>
      b.id === editId
        ? {
            ...b,
            titulo: editBook.titulo,
            autor: editBook.autor,
            genero: editBook.genero,
            quantidade: Number(editBook.quantidade) || 0,
            capa: editBook.capa,
          }
        : b
    );
    setBooks(updated);
    localStorage.setItem(K_BOOKS, JSON.stringify(updated));
    cancelEditBook();
  };

  // ===== Empréstimos =====
  const setPrazo = (eid, dataISO) => {
    const next = emprestimos.map((x) =>
      x.id === eid ? { ...x, prazo: dataISO } : x
    );
    setEmprestimos(next);
    localStorage.setItem(K_LOANS, JSON.stringify(next));
  };

  const aprovarEmprestimo = (eid) => {
    const nextLoans = emprestimos.map((x) =>
      x.id === eid
        ? {
            ...x,
            status: "Emprestado",
            dataEmprestimo: todayISO(),
            prazo: x.prazo || addDaysISO(todayISO(), 7),
          }
        : x
    );
    setEmprestimos(nextLoans);
    localStorage.setItem(K_LOANS, JSON.stringify(nextLoans));

    const emp = emprestimos.find((x) => x.id === eid);
    if (emp?.livro?.id) {
      const updatedBooks = books.map((b) =>
        b.id === emp.livro.id
          ? { ...b, quantidade: Math.max(0, Number(b.quantidade || 0) - 1) }
          : b
      );
      setBooks(updatedBooks);
      localStorage.setItem(K_BOOKS, JSON.stringify(updatedBooks));
    }

    pushNotif({ type: "info", text: "Empréstimo aprovado.", refId: eid });
  };

  const marcarDevolvido = (eid) => {
    const nextLoans = emprestimos.map((x) =>
      x.id === eid ? { ...x, status: "Devolvido", devolvido: true } : x
    );
    setEmprestimos(nextLoans);
    localStorage.setItem(K_LOANS, JSON.stringify(nextLoans));

    const emp = emprestimos.find((x) => x.id === eid);
    if (emp?.livro?.id) {
      const updatedBooks = books.map((b) =>
        b.id === emp.livro.id
          ? { ...b, quantidade: Number(b.quantidade || 0) + 1 }
          : b
      );
      setBooks(updatedBooks);
      localStorage.setItem(K_BOOKS, JSON.stringify(updatedBooks));
    }

    pushNotif({ type: "info", text: "Devolução registrada.", refId: eid });
  };

  // ===== Usuários =====
  const startEdit = (u) => {
    setEditingId(u.id);
    setNovaSenha("");
  };

  const salvarSenha = (u) => {
    if (!novaSenha || novaSenha.length < 4)
      return alert("A nova senha deve ter pelo menos 4 caracteres.");
    const updated = users.map((usr) =>
      usr.id === u.id ? { ...usr, senha: novaSenha } : usr
    );
    setUsers(updated);
    localStorage.setItem(K_USERS, JSON.stringify(updated));
    setEditingId(null);
    setNovaSenha("");
    alert(`Senha de "${u.nome}" atualizada!`);
  };

  const excluirUsuario = (u) => {
    if (!window.confirm(`Excluir o usuário "${u.nome}"?`)) return;
    const updated = users.filter((x) => x.id !== u.id);
    setUsers(updated);
    localStorage.setItem(K_USERS, JSON.stringify(updated));
  };

  // Filtros usuários
  const filtrados = users.filter((u) =>
    (u.nome || "").toLowerCase().includes(buscaUsuario.toLowerCase())
  );
  const alunos = filtrados.filter((u) => u.tipo === "aluno");
  const funcionarios = filtrados.filter((u) => u.tipo === "funcionario");
  const bibliotecarios = filtrados.filter((u) => u.tipo === "bibliotecario");

  // listas para selects de gênero/autor
  const generosDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((b) => (b.genero || "").trim())
            .filter((g) => g && g !== "Gênero não definido")
        )
      ).sort(),
    [books]
  );

  const autoresDisponiveis = useMemo(
    () =>
      Array.from(
        new Set(books.map((b) => (b.autor || "").trim()).filter((a) => a))
      ).sort(),
    [books]
  );

  const livrosFiltrados = books.filter(
    (b) =>
      b.titulo.toLowerCase().includes(buscaLivro.toLowerCase()) ||
      b.autor.toLowerCase().includes(buscaLivro.toLowerCase())
  );

  return (
    <div className="bib-page">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />
      <header className="bib-top">
        <h2>
          <Book size={22} /> Painel do Bibliotecário
        </h2>
        <div className="bib-actions">
          <div className="notif-wrapper">
            <button
              className={`btn-bell ${unreadCount > 0 ? "ativo" : ""}`}
              onClick={() => {
                setNotifOpen((o) => !o);
                markAllRead();
              }}
              aria-label="Notificações"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="badge-dot">{unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="notif-panel">
                <div className="notif-head">
                  <strong>Notificações</strong>
                  <button
                    className="btn-mini"
                    onClick={() => persistNotifs([])}
                  >
                    Limpar tudo
                  </button>
                </div>
                {notifs.length === 0 ? (
                  <p className="vazio">Sem notificações.</p>
                ) : (
                  <ul>
                    {notifs.map((n) => (
                      <li
                        key={n.id}
                        className={`n-${n.type} ${n.read ? "read" : ""}`}
                      >
                        {n.type === "warning" && (
                          <AlertTriangle size={16} color="#ffdd55" />
                        )}
                        {n.type === "info" && (
                          <Info size={16} color="#3771c8" />
                        )}
                        <span className="n-text">{n.text}</span>
                        <span className="n-time">
                          {new Date(n.ts).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="bib-right">
            <span className="bib-user">
              <User size={16} />{" "}
              <strong>{bibliotecario?.nome || "Bibliotecário"}</strong>
            </span>
            <button className="btn-logout" onClick={sair}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      <Tabs activeKey={tab} onSelect={(k) => setTab(k || "livros")}>
        {/* ===== LIVROS ===== */}
        <Tab
          eventKey="livros"
          title={
            <>
              <Book size={16} /> Livros
            </>
          }
        >
          <div className="tab-body">
            <div className="card">
              <h4>
                <PlusCircle size={16} /> Adicionar livro manualmente
              </h4>
              <form onSubmit={adicionarLivroManual}>
                <input
                  type="text"
                  placeholder="Título"
                  value={novoLivro.titulo}
                  onChange={(e) =>
                    setNovoLivro({ ...novoLivro, titulo: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Autor"
                  value={novoLivro.autor}
                  onChange={(e) =>
                    setNovoLivro({ ...novoLivro, autor: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Gênero"
                  value={novoLivro.genero}
                  onChange={(e) =>
                    setNovoLivro({ ...novoLivro, genero: e.target.value })
                  }
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Quantidade"
                  value={novoLivro.quantidade}
                  onChange={(e) =>
                    setNovoLivro({ ...novoLivro, quantidade: e.target.value })
                  }
                />

                <div
                  className="upload-area"
                  onPaste={(e) => {
                    const items = Array.from(e.clipboardData?.items || []);
                    const img = items.find((i) => i.type?.startsWith("image/"));
                    if (!img) return alert("Cole uma imagem válida (Ctrl+V).");
                    const file = img.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) =>
                      setNovoLivro({ ...novoLivro, capa: ev.target.result });
                    reader.readAsDataURL(file);
                  }}
                >
                  {novoLivro.capa ? (
                    <img
                      src={novoLivro.capa}
                      alt="Capa"
                      className="preview-capa"
                    />
                  ) : (
                    <p>Cole uma imagem aqui (Ctrl + V)</p>
                  )}
                </div>
                <button className="btn-azul">Adicionar</button>
              </form>
            </div>

            <div className="card">
              <h4>
                <Book size={16} /> Buscar livro pela API (Google Books)
              </h4>
              <form onSubmit={buscarNaAPI} className="search-row">
                <input
                  type="text"
                  placeholder="Título ou autor..."
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                />
                <button className="btn-azul">Buscar</button>
              </form>
              <div className="livros-grid">
                {resultados.map((livro) => (
                  <div key={livro.id} className="livro-card">
                    <img
                      src={livro.capa || "https://via.placeholder.com/120x160"}
                      alt={livro.titulo}
                    />
                    <h5 title={livro.titulo}>{livro.titulo}</h5>
                    <p className="autor">{livro.autor}</p>
                    <button
                      className="btn-amarelo"
                      onClick={() => adicionarLivroAPI(livro)}
                    >
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Catálogo atual */}
            {/* 🔍 Barra de pesquisa */}
            <div className="search-wrapper">
              <div className="search-box">
                <Search size={18} color="#3771c8" />
                <input
                  type="text"
                  placeholder="Pesquisar por título ou autor..."
                  value={buscaLivro}
                  onChange={(e) => setBuscaLivro(e.target.value)}
                />
              </div>

              <select
                className="filter-select"
                value={filtroLivro}
                onChange={(e) => setFiltroLivro(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="disponiveis">Disponíveis</option>
                <option value="indisponiveis">Indisponíveis</option>
              </select>

              <select
                className="filter-select"
                value={filtroGenero}
                onChange={(e) => setFiltroGenero(e.target.value)}
              >
                <option value="todos">Todos os gêneros</option>
                {generosDisponiveis.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filtroAutor}
                onChange={(e) => setFiltroAutor(e.target.value)}
              >
                <option value="todos">Todos os autores</option>
                {autoresDisponiveis.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <h4 className="sec-title">Catálogo atual</h4>
            <div className="livros-grid">
              {livrosFiltrados.length === 0 ? (
                <p className="vazio">Nenhum livro encontrado.</p>
              ) : (
                livrosFiltrados
                  .filter((b) => {
                    if (filtroLivro === "disponiveis") {
                      return Number(b.quantidade) > 0;
                    }
                    if (filtroLivro === "indisponiveis") {
                      return Number(b.quantidade) === 0;
                    }
                    return true;
                  })
                  .filter((b) => {
                    if (filtroGenero === "todos") return true;
                    const genero = (b.genero || "").toLowerCase();
                    return genero.includes(filtroGenero.toLowerCase());
                  })
                  .filter((b) => {
                    if (filtroAutor === "todos") return true;
                    const autor = (b.autor || "").toLowerCase();
                    return autor.includes(filtroAutor.toLowerCase());
                  })
                  .map((b) => (
                    <div key={b.id} className="livro-card">
                      <img
                        src={b.capa || "https://via.placeholder.com/120x160"}
                        alt={b.titulo}
                      />
                      {editId === b.id ? (
                        <>
                          <input
                            type="text"
                            value={editBook.titulo}
                            onChange={(e) =>
                              setEditBook((p) => ({
                                ...p,
                                titulo: e.target.value,
                              }))
                            }
                            placeholder="Título"
                          />
                          <input
                            type="text"
                            value={editBook.autor}
                            onChange={(e) =>
                              setEditBook((p) => ({
                                ...p,
                                autor: e.target.value,
                              }))
                            }
                            placeholder="Autor"
                          />
                          <input
                            type="text"
                            value={editBook.genero}
                            onChange={(e) =>
                              setEditBook((p) => ({
                                ...p,
                                genero: e.target.value,
                              }))
                            }
                            placeholder="Gênero"
                          />
                          <input
                            type="number"
                            min="0"
                            value={editBook.quantidade}
                            onChange={(e) =>
                              setEditBook((p) => ({
                                ...p,
                                quantidade: e.target.value,
                              }))
                            }
                            placeholder="Quantidade"
                          />
                          <div
                            className="upload-area mini"
                            title="Cole uma nova capa (Ctrl+V)"
                            onPaste={(e) => {
                              const items = Array.from(
                                e.clipboardData?.items || []
                              );
                              const img = items.find((i) =>
                                i.type?.startsWith("image/")
                              );
                              if (!img) return alert("Cole uma imagem válida.");
                              const file = img.getAsFile();
                              const reader = new FileReader();
                              reader.onload = (ev) =>
                                setEditBook((p) => ({
                                  ...p,
                                  capa: ev.target.result,
                                }));
                              reader.readAsDataURL(file);
                            }}
                          >
                            {editBook.capa ? (
                              <img
                                src={editBook.capa}
                                alt="Capa"
                                className="preview-capa"
                              />
                            ) : (
                              <p>Cole a nova capa aqui</p>
                            )}
                          </div>
                          <div className="row-btns">
                            <button
                              className="btn-verde"
                              onClick={saveEditBook}
                            >
                              <Save size={14} /> Salvar
                            </button>
                            <button
                              className="btn-vermelho"
                              onClick={cancelEditBook}
                            >
                              <X size={14} /> Cancelar
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <h5 title={b.titulo}>{b.titulo}</h5>
                          <p className="autor">{b.autor}</p>
                          <p className="genero">{b.genero}</p>
                          <p className="qtd">
                            Qtd:{" "}
                            <strong
                              style={{
                                color:
                                  Number(b.quantidade) === 0
                                    ? "red"
                                    : "#0c1a35",
                              }}
                            >
                              {b.quantidade}
                            </strong>
                          </p>
                          <div className="row-btns">
                            <button
                              className="btn-azul"
                              onClick={() => startEditBook(b)}
                            >
                              <Pencil size={14} /> Editar
                            </button>
                            <button
                              className="btn-vermelho"
                              onClick={() => excluirLivro(b.id)}
                            >
                              <Trash2 size={14} /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </Tab>

        {/* ===== USUÁRIOS ===== */}
        <Tab
          eventKey="usuarios"
          title={
            <>
              <Users size={16} /> Usuários
            </>
          }
        >
          <div className="tab-body">
            <div className="card">
              <h4>Pesquisar usuários</h4>
              <input
                className="input-full"
                type="text"
                placeholder="Digite um nome..."
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
              />
            </div>

            {/* Alunos */}
            <UserTable
              titulo="Alunos"
              columns={["Nome", "Turma", "Senha", "Ações"]}
              renderRow={(u) => (
                <>
                  <td>{u.nome}</td>
                  <td>{u.turma || "-"}</td>
                  <SenhaCell
                    u={u}
                    editingId={editingId}
                    novaSenha={novaSenha}
                    setNovaSenha={setNovaSenha}
                    startEdit={startEdit}
                    salvarSenha={salvarSenha}
                  />
                  <td className="td-actions">
                    <button
                      className="btn-vermelho"
                      onClick={() => excluirUsuario(u)}
                      title="Excluir usuário"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </>
              )}
              data={alunos}
              vazio="Nenhum aluno encontrado."
            />

            {/* Funcionários */}
            <UserTable
              titulo="Funcionários"
              columns={["Nome", "Função", "Turno", "Senha", "Ações"]}
              renderRow={(u) => (
                <>
                  <td>{u.nome}</td>
                  <td>{u.funcao || "-"}</td>
                  <td>{u.turno || "-"}</td>
                  <SenhaCell
                    u={u}
                    editingId={editingId}
                    novaSenha={novaSenha}
                    setNovaSenha={setNovaSenha}
                    startEdit={startEdit}
                    salvarSenha={salvarSenha}
                  />
                  <td className="td-actions">
                    <button
                      className="btn-vermelho"
                      onClick={() => excluirUsuario(u)}
                      title="Excluir usuário"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </>
              )}
              data={funcionarios}
              vazio="Nenhum funcionário encontrado."
            />

            {/* Bibliotecários */}
            <UserTable
              titulo="Bibliotecários"
              columns={["Nome", "Turno", "Senha", "Ações"]}
              renderRow={(u) => (
                <>
                  <td>{u.nome}</td>
                  <td>{u.turno || "-"}</td>
                  <SenhaCell
                    u={u}
                    editingId={editingId}
                    novaSenha={novaSenha}
                    setNovaSenha={setNovaSenha}
                    startEdit={startEdit}
                    salvarSenha={salvarSenha}
                  />
                  <td className="td-actions">
                    <button
                      className="btn-vermelho"
                      onClick={() => excluirUsuario(u)}
                      title="Excluir usuário"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </>
              )}
              data={bibliotecarios}
              vazio="Nenhum bibliotecário encontrado."
            />
          </div>
        </Tab>

        {/* ===== EMPRÉSTIMOS ===== */}
        <Tab
          eventKey="emprestimos"
          title={
            <>
              <Archive size={16} /> Empréstimos
            </>
          }
        >
          <div className="tab-body">
            {emprestimos.length === 0 ? (
              <p className="vazio">Nenhum empréstimo registrado.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Tipo</th>
                    <th>Livro</th>
                    <th>Data</th>
                    <th>Prazo</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {emprestimos.map((e) => (
                    <tr key={e.id}>
                      <td>{e.usuario?.nome}</td>
                      <td>{e.usuario?.tipo}</td>
                      <td>{e.livro?.titulo}</td>
                      <td>{e.dataEmprestimo || "-"}</td>
                      <td>
                        <input
                          type="date"
                          value={e.prazo || ""}
                          onChange={(ev) => setPrazo(e.id, ev.target.value)}
                          disabled={e.devolvido}
                          aria-label="Prazo de devolução"
                        />
                      </td>
                      <td>
                        <span
                          className={
                            e.status === "Devolvido"
                              ? "badge verde"
                              : isAtrasado(e.prazo)
                              ? "badge vermelho"
                              : "badge amarelo"
                          }
                        >
                          {e.status || "Pendente"}
                        </span>
                      </td>
                      <td className="td-actions">
                        {e.status === "Pendente" && (
                          <button
                            className="btn-azul"
                            onClick={() => aprovarEmprestimo(e.id)}
                          >
                            Aprovar
                          </button>
                        )}
                        {e.status === "Emprestado" && (
                          <button
                            className="btn-verde"
                            onClick={() => marcarDevolvido(e.id)}
                          >
                            Devolvido
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Tab>
      </Tabs>
    </div>
  );
}

/* ========= Subcomponentes ========= */

function UserTable({ titulo, columns, data, renderRow, vazio }) {
  return (
    <div className="card">
      <h4>{titulo}</h4>
      {data.length === 0 ? (
        <p className="vazio">{vazio}</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>{renderRow(u)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SenhaCell({
  u,
  editingId,
  novaSenha,
  setNovaSenha,
  startEdit,
  salvarSenha,
}) {
  return (
    <td>
      <div className="senha-box">
        <input
          type="password"
          readOnly
          value={u.senha || ""}
          aria-label={`Senha de ${u.nome}`}
        />
      </div>
      <div className="senha-actions">
        {editingId === u.id ? (
          <>
            <input
              type="password"
              placeholder="Nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
            />
            <button className="btn-azul" onClick={() => salvarSenha(u)}>
              <CheckCircle size={14} /> Salvar
            </button>
          </>
        ) : (
          <button className="btn-azul" onClick={() => startEdit(u)}>
            Redefinir
          </button>
        )}
      </div>
    </td>
  );
}
