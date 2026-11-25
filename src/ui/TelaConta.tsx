import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CLUBES, DIVISOES_INICIAIS } from "../data/clubes";
import { online, type Perfil, type Usuario } from "../data/online";
import { LIGAS } from "../engine/ligas";
import { escalar } from "../engine/ratings";
import type { Time } from "../engine/types";

/** Países para o perfil do técnico (o país de onde ele joga, não o da carreira). */
const PAISES = [
  "Brasil",
  "Portugal",
  "Angola",
  "Moçambique",
  "Argentina",
  "Uruguai",
  "Paraguai",
  "Chile",
  "Colômbia",
  "Peru",
  "Bolívia",
  "Equador",
  "Venezuela",
  "México",
  "Estados Unidos",
  "Canadá",
  "Inglaterra",
  "Escócia",
  "Espanha",
  "Itália",
  "Alemanha",
  "França",
  "Holanda",
  "Bélgica",
  "Suíça",
  "Áustria",
  "Dinamarca",
  "Noruega",
  "Sérvia",
  "Japão",
  "Arábia Saudita",
  "Outro",
];

const IDADE_MINIMA = 13;

/** Mesmas regras do servidor (api/auth.php); o servidor confere de novo. */
const regras = {
  usuario: (u: string) =>
    /^[A-Za-z0-9_.-]{3,20}$/.test(u)
      ? null
      : "De 3 a 20 letras sem acento, números, ponto, hífen ou sublinhado.",
  email: (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
      ? null
      : "Digite um e-mail válido.",
  senha: (s: string, usuario: string) =>
    s.length < 8 || s.length > 72 || !/\p{L}/u.test(s) || !/\d/.test(s)
      ? "Use de 8 a 72 caracteres, com pelo menos uma letra e um número."
      : s.toLowerCase() === usuario.toLowerCase()
        ? "A senha não pode ser igual ao usuário."
        : null,
  tecnico: (t: string) =>
    /^\p{L}[\p{L} .'-]{1,39}$/u.test(t.trim().replace(/\s+/g, " "))
      ? null
      : "De 2 a 40 letras (pode ter espaço, ponto, hífen e apóstrofo).",
  nascimento: (n: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) return "Digite a data de nascimento.";
    const d = new Date(`${n}T00:00:00`);
    const hoje = new Date();
    if (Number.isNaN(d.getTime()) || d > hoje) return "Data inválida.";
    let idade = hoje.getFullYear() - d.getFullYear();
    if (
      hoje.getMonth() < d.getMonth() ||
      (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())
    )
      idade--;
    if (idade > 110) return "Data inválida.";
    return idade < IDADE_MINIMA
      ? `É preciso ter pelo menos ${IDADE_MINIMA} anos.`
      : null;
  },
};

const clubesPorNome = [...CLUBES].sort((a, b) =>
  a.nome.localeCompare(b.nome, "pt-BR"),
);

/** Entrada do jogo: entrar com usuário ou e-mail, ou criar uma conta (com o clube da carreira). */
export function Entrar({
  times,
  onEntrou,
}: {
  times: Time[];
  onEntrou: (u: Usuario) => void;
}) {
  const [criar, setCriar] = useState(false);
  return criar ? (
    <Cadastro
      times={times}
      onEntrou={onEntrou}
      onVoltar={() => setCriar(false)}
    />
  ) : (
    <Login onEntrou={onEntrou} onCriar={() => setCriar(true)} />
  );
}

function Login({
  onEntrou,
  onCriar,
}: {
  onEntrou: (u: Usuario) => void;
  onCriar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="entrar caixa-entrar"
      onSubmit={async (e) => {
        e.preventDefault();
        setErro(null);
        setEnviando(true);
        try {
          onEntrou(await online.entrar(nome.trim(), senha));
        } catch (err) {
          setErro((err as Error).message);
        } finally {
          setEnviando(false);
        }
      }}
    >
      <h2>Entrar</h2>
      <p className="suave">
        O jogo fica na sua conta: carreira, cartas, caixa e moedas. Um caixa só
        para contratar, pagar salários e jogar o ranqueado.
      </p>
      <label>
        Usuário ou e-mail
        <input
          id="online-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label>
        Senha
        <input
          id="online-senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {erro && <p className="aviso">{erro}</p>}
      <button
        className="botao primario"
        disabled={enviando || nome.trim().length < 3 || !senha}
      >
        Entrar
      </button>
      <button type="button" className="link" onClick={onCriar}>
        Não tenho conta: criar uma
      </button>
    </form>
  );
}

interface CamposPerfil {
  perfil: Perfil;
  setPerfil: (p: Perfil) => void;
  tocado: boolean;
  /** Conta antiga com carreira: o nome do técnico já é o da carreira. */
  tecnicoFixo?: string | null;
}

/** Nome do técnico, e-mail, nascimento, país, clube do coração e termos. */
function CamposDoPerfil({
  perfil,
  setPerfil,
  tocado,
  tecnicoFixo,
}: CamposPerfil) {
  const muda = (campo: keyof Perfil) => (e: { target: { value: string } }) =>
    setPerfil({ ...perfil, [campo]: e.target.value });
  return (
    <>
      {tecnicoFixo ? (
        <p className="suave">
          Técnico: <b>{tecnicoFixo}</b> (o nome da sua carreira).
        </p>
      ) : (
        <Campo
          rotulo="Nome do técnico"
          erro={tocado ? regras.tecnico(perfil.tecnico) : null}
        >
          <input
            id="cad-tecnico"
            maxLength={40}
            value={perfil.tecnico}
            onChange={muda("tecnico")}
            autoComplete="name"
          />
        </Campo>
      )}
      <Campo rotulo="E-mail" erro={tocado ? regras.email(perfil.email) : null}>
        <input
          id="cad-email"
          type="email"
          maxLength={120}
          value={perfil.email}
          onChange={muda("email")}
          autoComplete="email"
        />
      </Campo>
      <div className="cad-linha">
        <Campo
          rotulo="Data de nascimento"
          erro={tocado ? regras.nascimento(perfil.nascimento) : null}
        >
          <input
            id="cad-nascimento"
            type="date"
            value={perfil.nascimento}
            onChange={muda("nascimento")}
            autoComplete="bday"
          />
        </Campo>
        <Campo
          rotulo="País"
          erro={tocado && !perfil.pais ? "Escolha o seu país." : null}
        >
          <select id="cad-pais" value={perfil.pais} onChange={muda("pais")}>
            <option value="">Escolha…</option>
            {PAISES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Clube do coração (opcional)">
        <select
          id="cad-coracao"
          value={perfil.clube_coracao}
          onChange={muda("clube_coracao")}
        >
          <option value="">Nenhum</option>
          {clubesPorNome.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      <label className="cad-termos">
        <input
          id="cad-termos"
          type="checkbox"
          checked={perfil.termos}
          onChange={(e) => setPerfil({ ...perfil, termos: e.target.checked })}
        />
        <span>
          Li e aceito os termos de uso: o jogo é gratuito, cada conta é pessoal
          e tem uma única carreira, e contas que trapaceiam podem ser suspensas.
        </span>
      </label>
      {tocado && !perfil.termos && (
        <span className="cad-erro">
          É preciso aceitar os termos para jogar.
        </span>
      )}
    </>
  );
}

function Campo({
  rotulo,
  erro,
  children,
}: {
  rotulo: string;
  erro?: string | null;
  children: ReactNode;
}) {
  return (
    <label className={erro ? "com-erro" : undefined}>
      {rotulo}
      {children}
      {erro && <span className="cad-erro">{erro}</span>}
    </label>
  );
}

const PERFIL_VAZIO: Perfil = {
  email: "",
  tecnico: "",
  nascimento: "",
  pais: "",
  clube_coracao: "",
  termos: false,
};
const perfilOk = (p: Perfil, tecnicoFixo?: string | null) =>
  !regras.email(p.email) &&
  (tecnicoFixo || !regras.tecnico(p.tecnico)) &&
  !regras.nascimento(p.nascimento) &&
  !!p.pais &&
  p.termos;

function Cadastro({
  times,
  onEntrou,
  onVoltar,
}: {
  times: Time[];
  onEntrou: (u: Usuario) => void;
  onVoltar: () => void;
}) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VAZIO);
  const [paisCarreira, setPaisCarreira] = useState("Brasil");
  const [divisao, setDivisao] = useState("A");
  const [clube, setClube] = useState("");
  const [tocado, setTocado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Força = média do geral dos 11 titulares automáticos (igual à escolha de clube).
  const forca = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of times) {
      const v = escalar({ ...t, titulares: [] });
      m.set(
        t.id,
        Math.round(
          v.reduce((s, x) => s + x.jogador.geral, 0) / Math.max(1, v.length),
        ),
      );
    }
    return m;
  }, [times]);
  const paisesCarreira = [...new Set(LIGAS.map((l) => l.pais))];
  const divisoes = LIGAS.filter((l) => l.pais === paisCarreira);
  const clubes = CLUBES.filter(
    (c) => DIVISOES_INICIAIS[c.id] === divisao && forca.has(c.id),
  ).sort((a, b) => (forca.get(b.id) ?? 0) - (forca.get(a.id) ?? 0));
  const escolhido = CLUBES.find((c) => c.id === clube);

  const erroSenha2 = senha2 !== senha ? "As senhas não conferem." : null;
  const tudoOk =
    !regras.usuario(usuario) &&
    !regras.senha(senha, usuario) &&
    !erroSenha2 &&
    perfilOk(perfil) &&
    !!escolhido;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setTocado(true);
    setErro(null);
    if (!tudoOk) return;
    setEnviando(true);
    try {
      onEntrou(
        await online.registrar({ ...perfil, usuario, senha, senha2, clube }),
      );
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="entrar caixa-entrar cadastro" onSubmit={enviar} noValidate>
      <h2>Criar conta</h2>
      <p className="suave">
        Cada conta tem uma única carreira, no clube que você escolher aqui. Ele
        fica com você para sempre: para comandar outro clube, só com outra
        conta.
      </p>

      <fieldset>
        <legend>Acesso</legend>
        <Campo
          rotulo="Usuário (para entrar e aparecer no ranqueado)"
          erro={tocado ? regras.usuario(usuario) : null}
        >
          <input
            id="cad-usuario"
            maxLength={20}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
          />
        </Campo>
        <div className="cad-linha">
          <Campo
            rotulo="Senha"
            erro={tocado ? regras.senha(senha, usuario) : null}
          >
            <input
              id="cad-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
          </Campo>
          <Campo rotulo="Confirme a senha" erro={tocado ? erroSenha2 : null}>
            <input
              id="cad-senha2"
              type="password"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              autoComplete="new-password"
            />
          </Campo>
        </div>
        {!(tocado && regras.senha(senha, usuario)) && (
          <span className="suave cad-dica">
            Pelo menos 8 caracteres, com letra e número.
          </span>
        )}
      </fieldset>

      <fieldset>
        <legend>Técnico</legend>
        <CamposDoPerfil perfil={perfil} setPerfil={setPerfil} tocado={tocado} />
      </fieldset>

      <fieldset>
        <legend>Sua carreira</legend>
        <div className="cad-linha">
          <Campo rotulo="País da liga">
            <select
              id="cad-pais-carreira"
              value={paisCarreira}
              onChange={(e) => {
                const p = e.target.value;
                setPaisCarreira(p);
                setDivisao(LIGAS.find((l) => l.pais === p)!.id);
                setClube("");
              }}
            >
              {paisesCarreira.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Divisão">
            <select
              id="cad-divisao"
              value={divisao}
              onChange={(e) => {
                setDivisao(e.target.value);
                setClube("");
              }}
            >
              {divisoes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo
          rotulo="Clube"
          erro={
            tocado && !escolhido ? "Escolha o clube da sua carreira." : null
          }
        >
          <select
            id="cad-clube"
            value={clube}
            onChange={(e) => setClube(e.target.value)}
          >
            <option value="">Escolha…</option>
            {clubes.map((c, i) => (
              <option key={c.id} value={c.id}>
                {c.nome} · força {forca.get(c.id)} ·{" "}
                {i < clubes.length / 3
                  ? "favorito"
                  : i < (2 * clubes.length) / 3
                    ? "meio de tabela"
                    : "desafio"}
              </option>
            ))}
          </select>
        </Campo>
      </fieldset>

      {tocado && !tudoOk ? (
        <p className="aviso">Confira os campos marcados.</p>
      ) : (
        erro && <p className="aviso">{erro}</p>
      )}
      <button className="botao primario" disabled={enviando}>
        {escolhido
          ? `Criar conta e assumir o ${escolhido.nome}`
          : "Criar conta"}
      </button>
      <button type="button" className="link" onClick={onVoltar}>
        Já tenho conta
      </button>
    </form>
  );
}

/** Contas de antes do cadastro completo: preenchem e-mail, nascimento, país e termos uma vez. */
export function CompletarCadastro({
  usuario,
  onPronto,
}: {
  usuario: Usuario;
  onPronto: (u: Usuario) => void;
}) {
  const [perfil, setPerfil] = useState<Perfil>({
    ...PERFIL_VAZIO,
    email: usuario.email ?? "",
    tecnico: usuario.tecnico ?? "",
    nascimento: usuario.nascimento ?? "",
    pais: usuario.pais ?? "",
    clube_coracao: usuario.clubeCoracao ?? "",
  });
  const [tocado, setTocado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="entrar caixa-entrar cadastro"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTocado(true);
        setErro(null);
        if (!perfilOk(perfil, usuario.tecnico)) {
          setErro("Confira os campos marcados.");
          return;
        }
        setEnviando(true);
        try {
          onPronto(await online.completar(perfil));
        } catch (err) {
          setErro((err as Error).message);
        } finally {
          setEnviando(false);
        }
      }}
    >
      <h2>Complete seu cadastro</h2>
      <p className="suave">
        Conta <b>{usuario.nome}</b>: o cadastro agora pede alguns dados a mais.
        Preencha uma vez para continuar jogando.
      </p>
      <CamposDoPerfil
        perfil={perfil}
        setPerfil={setPerfil}
        tocado={tocado}
        tecnicoFixo={usuario.tecnico}
      />
      {erro && <p className="aviso">{erro}</p>}
      <button className="botao primario" disabled={enviando}>
        Salvar e continuar
      </button>
    </form>
  );
}
