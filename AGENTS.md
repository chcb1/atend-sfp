<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Derive mobile overflow navigation from the same permission-filtered items as desktop navigation so both surfaces retain identical access visibility.
- Agenda undo uses existing authenticated scheduling mutations and refreshes schedule, appointments, dashboard, and forecast caches so business rules and totals remain consistent.
- Root owns the single auth event subscription and shares session email through context; session-ID transitions distinguish fresh login from restoration or focus so idle expiration is not renewed accidentally.
- Desktop operational navigation and account links partition the same permission-filtered list used by mobile navigation, preventing inconsistent access visibility.
