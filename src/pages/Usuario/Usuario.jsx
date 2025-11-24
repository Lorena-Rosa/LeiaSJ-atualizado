import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, User, AlertTriangle, Search } from "lucide-react";
import "./Usuario.css";

export default function Usuario() {
  const [livros, setLivros] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroAutor, setFiltroAutor] = useState("todos");
  const [filtroGenero, setFiltroGenero] = useState("todos");
  const [filtroDisp, setFiltroDisp] = useState("todos");

  const navigate = useNavigate();

  // === Carrega usuário e livros ===
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("leiasj_logged_user"));
    if (!userData) {
      navigate("/login");
      return;
    }
    setUsuario(userData);

    const livrosSalvos =
      JSON.parse(localStorage.getItem("leiasj_books_v1")) || [];
    setLivros(livrosSalvos);
  }, [navigate]);

  // === Solicitação de empréstimo ===
  const solicitarEmprestimo = (livro) => {
    if (!usuario) return alert("Você precisa estar logado para solicitar.");
    if (Number(livro.quantidade) <= 0) {
      alert(`O livro "${livro.titulo}" não está disponível no momento.`);
      return;
    }

    const emprestimos =
      JSON.parse(localStorage.getItem("leiasj_loans_v1")) || [];
    const novo = {
      id: Date.now(),
      usuario: { nome: usuario.nome, tipo: usuario.tipo },
      livro: { titulo: livro.titulo, id: livro.id },
      dataEmprestimo: new Date().toLocaleDateString("pt-BR"),
      prazo: "A definir",
      status: "Pendente",
    };
    emprestimos.push(novo);
    localStorage.setItem("leiasj_loans_v1", JSON.stringify(emprestimos));
    alert("Solicitação enviada!");
  };

  // === Verificação de prazos ===
  const verificarPrazos = useCallback(() => {
    const emprestimos =
      JSON.parse(localStorage.getItem("leiasj_loans_v1")) || [];
    const meus = emprestimos.filter(
      (e) => e.usuario?.nome === usuario?.nome && e.status === "Emprestado"
    );

    const hoje = new Date();
    const novas = [];

    meus.forEach((e) => {
      if (!e.prazo || e.prazo === "A definir") return;
      const prazo = new Date(e.prazo);
      const diff = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
      if (diff <= 3 && diff >= 0) {
        novas.push({
          id: e.id,
          livro: e.livro?.titulo,
          dias: diff,
        });
      }
    });

    setNotificacoes(novas);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    verificarPrazos();
    const interval = setInterval(verificarPrazos, 15000);
    return () => clearInterval(interval);
  }, [usuario, verificarPrazos]);

  // === Logout ===
  const handleLogout = () => {
    if (window.confirm("Tem certeza que deseja sair?")) {
      localStorage.removeItem("leiasj_logged_user");
      navigate("/login");
    }
  };

  // === Listas de filtros ===
  const autores = ["todos", ...new Set(livros.map((l) => l.autor))];
  const generos = ["todos", ...new Set(livros.map((l) => l.genero))];

  return (
    <div className="usuario-page">
      {/* HEADER AZUL */}
      <header className="usuario-header">
        <h2>Catálogo de Livros</h2>

        {usuario && (
          <div className="usuario-info">
            <div className="user-icon">
              <User size={18} />
              <span>{usuario.nome}</span>
            </div>

            {/* 🔔 */}
            <div className="notif-wrapper">
              <button
                className={`btn-bell ${notificacoes.length > 0 ? "ativo" : ""}`}
                onClick={() => setMostrarNotificacoes((v) => !v)}
              >
                <Bell size={22} />
                {notificacoes.length > 0 && (
                  <span className="badge-dot">{notificacoes.length}</span>
                )}
              </button>

              {mostrarNotificacoes && (
                <div className="notif-panel">
                  <div className="notif-head">
                    <strong>Notificações</strong>
                    <button
                      className="btn-mini"
                      onClick={() => setNotificacoes([])}
                    >
                      Limpar
                    </button>
                  </div>
                  <ul>
                    {notificacoes.length === 0 ? (
                      <li>Nenhum alerta.</li>
                    ) : (
                      notificacoes.map((n) => (
                        <li key={n.id}>
                          <AlertTriangle size={16} color="#ffdd55" />
                          <span>
                            O prazo de <b>{n.livro}</b> termina em{" "}
                            <b>{n.dias}</b> dia{n.dias > 1 ? "s" : ""}.
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>

            <button className="btn-sair" onClick={handleLogout}>
              Sair
            </button>
          </div>
        )}
      </header>

      {/* CAIXA BRANCA — FILTROS */}
      <div className="filtros-section">
        <div className="search-wrapper">
          {/* Busca */}
          <div className="search-box">
            <Search size={18} color="#3771c8" />
            <input
              type="text"
              placeholder="Pesquisar por título ou autor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Filtro Autor */}
          <select
            className="filter-select"
            value={filtroAutor}
            onChange={(e) => setFiltroAutor(e.target.value)}
          >
            {autores.map((a) => (
              <option key={a} value={a}>
                {a === "todos" ? "Todos os autores" : a}
              </option>
            ))}
          </select>

          {/* Filtro Gênero */}
          <select
            className="filter-select"
            value={filtroGenero}
            onChange={(e) => setFiltroGenero(e.target.value)}
          >
            {generos.map((g) => (
              <option key={g} value={g}>
                {g === "todos" ? "Todos os gêneros" : g}
              </option>
            ))}
          </select>

          {/* Filtro Disponibilidade */}
          <select
            className="filter-select"
            value={filtroDisp}
            onChange={(e) => setFiltroDisp(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="disp">Disponíveis</option>
            <option value="indisp">Indisponíveis</option>
          </select>
        </div>
      </div>

      {/* LISTA DE LIVROS */}
      <div className="livros-grid">
        {livros
          .filter(
            (l) =>
              l.titulo.toLowerCase().includes(busca.toLowerCase()) ||
              l.autor.toLowerCase().includes(busca.toLowerCase())
          )
          .filter((l) =>
            filtroAutor === "todos" ? true : l.autor === filtroAutor
          )
          .filter((l) =>
            filtroGenero === "todos" ? true : l.genero === filtroGenero
          )
          .filter((l) =>
            filtroDisp === "todos"
              ? true
              : filtroDisp === "disp"
              ? Number(l.quantidade) > 0
              : Number(l.quantidade) === 0
          )
          .map((livro) => {
            const indisponivel = Number(livro.quantidade) <= 0;
            return (
              <div key={livro.id} className="livro-card">
                <img
                  src={
                    livro.capa ||
                    "https://via.placeholder.com/120x160?text=Sem+Capa"
                  }
                  alt={livro.titulo}
                />
                <h4>{livro.titulo}</h4>
                <p className="autor">{livro.autor}</p>
                <p>
                  <strong>Gênero:</strong> {livro.genero}
                </p>
                <p className="qtd">
                  <strong>Disponíveis:</strong> {livro.quantidade}
                </p>

                {indisponivel && (
                  <div className="badge-indisponivel">Não disponível</div>
                )}

                <button
                  className="btn btn-warning btn-sm mt-2"
                  onClick={() => solicitarEmprestimo(livro)}
                  disabled={indisponivel}
                >
                  {indisponivel ? "Indisponível" : "Solicitar Empréstimo"}
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
