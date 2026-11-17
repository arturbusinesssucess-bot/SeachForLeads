# Padrão de botões do app

- Novas ações principais do app devem reutilizar `public/app-buttons.v1.css`: classes `app-button app-button--primary`, com a variante `app-button--compact` apenas quando fizer sentido.
- Use o azul da marca, fundo liso, cantos arredondados e brilho externo suave de LED. Não use borda visível, contorno permanente, textura pixelada, quadriculado ou brilho branco na borda.
- Inclua um ícone semântico à esquerda com a classe `app-button-icon` e o texto em `app-button-label`. Reutilize os SVGs fornecidos pelo usuário. Se precisar de um ícone novo, peça ao usuário o SVG.
- Nas ações de começar/iniciar/configurar uma busca e buscar empresas, use a lupa fornecida pelo usuário. Preserve os nomes, IDs, tipos, eventos e atributos de acessibilidade necessários à ação.
- Mantenha foco visível para teclado, estado desabilitado, alvos de toque de pelo menos 44 px e suporte a movimento reduzido. O foco de teclado não é uma borda decorativa permanente.
- Controles de navegação, filtros e seletores mantêm suas variantes próprias. Mudanças nos botões do app não autorizam alterar os CTAs da landing.
