import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { HiSearch } from 'react-icons/hi';

interface Company {
  id: number;
  codigo: string;
  nome: string;
  ativo: boolean;
}

export default function CompanySelection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = companies.filter(
        (company) =>
          company.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          company.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    } else {
      setFilteredCompanies(companies);
    }
  }, [searchTerm, companies]);

  const loadCompanies = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        navigate('/login');
        return;
      }

      const user = JSON.parse(userStr);
      const response = await api.getUserCompanies(user.id);

      if (response.data) {
        const userCompanies = response.data as Company[];
        setCompanies(userCompanies);
        setFilteredCompanies(userCompanies);

        // Se o usuário tiver apenas uma empresa, selecionar automaticamente
        if (userCompanies.length === 1) {
          selectCompany(userCompanies[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = (company: Company) => {
    try {
      // Salvar empresa selecionada no localStorage
      const companyData = {
        id: company.id,
        codigo: company.codigo,
        nome: company.nome,
        ativo: company.ativo
      };
      localStorage.setItem('selectedCompany', JSON.stringify(companyData));
      
      // Pequeno delay para garantir que o localStorage foi salvo
      setTimeout(() => {
        // Recarregar a página para garantir que o App.tsx reconheça a empresa selecionada
        // Usar window.location.href ao invés de navigate para forçar reload completo
        window.location.href = '/';
      }, 100);
    } catch (error) {
      console.error('Erro ao selecionar empresa:', error);
      // Mesmo com erro, tentar redirecionar
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-black/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop com blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      
      {/* Modal centralizado */}
      <div className="relative bg-background rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">
            Selecione a empresa que deseja acessar.
          </h1>

          {/* Barra de busca */}
          <div className="mb-6 relative">
            <input
              type="text"
              placeholder="Busca"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <HiSearch className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          </div>

          {/* Lista de empresas */}
          <div className="max-h-96 overflow-y-auto border border-border rounded-md">
            {filteredCompanies.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa disponível'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredCompanies.map((company) => (
                  <li
                    key={company.id}
                    onClick={() => selectCompany(company)}
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {company.codigo} - {company.nome}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

