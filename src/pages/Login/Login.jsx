import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Login.css";

export default function Login() {
  const [modo, setModo] = useState("login");
  const [tipo, setTipo] = useState("aluno");
  const [nome, setNome] = useState("");
  const [turma, setTurma] = useState("");
  const [funcao, setFuncao] = useState("");
  const [turno, setTurno] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const navigate = useNavigate();

  const turnos = ["Manhã", "Tarde", "Noite"];
  const funcoes = [
    "Professor",
    "Diretoria",
    "Coordenação",
    "Secretaria",
    "Auxiliar",
  ];

  function validarNomeCompleto(nome) {
    return nome.trim().split(" ").length >= 2;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validarNomeCompleto(nome)) return alert("Digite o nome completo.");
    if (!senha || senha.length < 4)
      return alert("A senha deve ter pelo menos 4 caracteres.");

    const key = "leiasj_users_v1";
    const users = JSON.parse(localStorage.getItem(key)) || [];

    if (modo === "cadastro") {
      if (tipo === "bibliotecario" && codigo !== "LEIA-SJ-2025")
        return alert("Código de bibliotecário inválido.");

      const existe = users.find(
        (u) => u.nome.toLowerCase() === nome.toLowerCase() && u.tipo === tipo
      );
      if (existe) return alert("Usuário já cadastrado.");

      const novo = {
        id: Date.now(),
        nome,
        tipo,
        senha,
        turma,
        funcao,
        turno,
        codigo,
      };
      users.push(novo);
      localStorage.setItem(key, JSON.stringify(users));
      alert("Cadastro realizado!");
      setModo("login");
      return;
    }

    const user = users.find(
      (u) =>
        u.nome.toLowerCase() === nome.toLowerCase() &&
        u.senha === senha &&
        u.tipo === tipo
    );
    if (!user) return alert("Usuário ou senha inválidos.");
    localStorage.setItem("leiasj_logged_user", JSON.stringify(user));
    navigate(user.tipo === "bibliotecario" ? "/bibliotecario" : "/usuario");
  }

  return (
    <div className="login-page d-flex align-items-center justify-content-center">
      <div className="card p-4 shadow-lg login-box">
        <div className="text-center mb-3">
          <h2 className="fw-bold text-primary">LeiaSJ</h2>
        </div>

        {/* Botões Entrar / Cadastrar */}
        <div className="btn-group w-100 mb-3" role="group">
          <button
            type="button"
            className={`btn ${
              modo === "login" ? "ativo" : "btn-outline-warning"
            }`}
            onClick={() => setModo("login")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`btn ${
              modo === "cadastro" ? "ativo" : "btn-outline-warning"
            }`}
            onClick={() => setModo("cadastro")}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tipo de usuário */}
          <div className="mb-3 tipo-user">
            <label>
              <input
                type="radio"
                value="aluno"
                checked={tipo === "aluno"}
                onChange={() => setTipo("aluno")}
              />{" "}
              Aluno
            </label>
            <label>
              <input
                type="radio"
                value="funcionario"
                checked={tipo === "funcionario"}
                onChange={() => setTipo("funcionario")}
              />{" "}
              Funcionário
            </label>
            <label>
              <input
                type="radio"
                value="bibliotecario"
                checked={tipo === "bibliotecario"}
                onChange={() => setTipo("bibliotecario")}
              />{" "}
              Bibliotecário
            </label>
          </div>

          <input
            type="text"
            placeholder="Nome completo"
            className="form-control mb-3"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          {/* Campos específicos */}
          {tipo === "aluno" && (
            <div className="mb-3 d-flex justify-content-between gap-2">
              <select
                className="form-select"
                value={turma.split("º")[0] || ""}
                onChange={(e) => {
                  const letra = turma.split("º")[1] || "";
                  setTurma(`${e.target.value}º${letra}`);
                }}
                required
              >
                <option value="">Série</option>
                {["6", "7", "8", "9", "1", "2", "3", "EJA"].map((num) => (
                  <option key={num} value={num}>
                    {num}º
                  </option>
                ))}
              </select>

              <select
                className="form-select"
                value={turma.replace(/^[0-9EJAº]+/, "") || ""}
                onChange={(e) => {
                  const numero = turma.split("º")[0] || "";
                  setTurma(`${numero}º${e.target.value}`);
                }}
                required
              >
                <option value="">Turma</option>
                {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map(
                  (letra) => (
                    <option key={letra} value={letra}>
                      {letra}
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          {tipo === "funcionario" && (
            <>
              <select
                className="form-select mb-3"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                required
              >
                <option value="">Selecione a função</option>
                {funcoes.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              <div className="d-flex justify-content-between mb-3">
                {turnos.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`btn btn-turno ${turno === t ? "ativo" : ""}`}
                    onClick={() => setTurno(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {tipo === "bibliotecario" && (
            <>
              <div className="d-flex justify-content-between mb-3">
                {turnos.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`btn btn-turno ${turno === t ? "ativo" : ""}`}
                    onClick={() => setTurno(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Código do bibliotecário"
                className="form-control mb-3"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </>
          )}

          <input
            type="password"
            placeholder="Senha"
            className="form-control mb-3"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <button type="submit" className="btn btn-warning w-100 fw-semibold">
            {modo === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
