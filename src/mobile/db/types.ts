export interface MobileClient {
  cli_codigo:  number;
  cli_nomred:  string;
  cli_cidade:  string;
  cli_uf:      string;
  cli_email:   string;
  cli_cnpj:    string;
  cli_fone1:   string;
  cli_endereco?: string;
  cli_endnum?:   string;
  cli_bairro?:   string;
  risk: 'ativo' | 'em_queda' | 'burnout';
}

export interface MobileProduct {
  pro_codprod: string;
  pro_nome: string;
  pro_industria: number;
  unidade: string;
}

export interface MobilePrice {
  pro_codprod: string;
  tabela_id: number;
  preco: number;
  industria_id: number;
}

export interface MobileOrder {
  id: number;
  ped_numero: number;
  cliente_nome: string;
  industria_nome: string;
  valor_total: number;
  data_pedido: string;
  situacao: string;
}

export interface QueuedOrder {
  id?: number;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pendente' | 'enviado' | 'erro';
}
