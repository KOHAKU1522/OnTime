// Keep subscription lifecycle testable without connecting to production Firebase.
export function watchTasks({ listen, onState, onError, schedule = setTimeout, cancel = clearTimeout }) {
    let active = true;
    let terminal = false;
    let awaitingServer = true;
    let timer;
    let unsubscribe = () => {};
    const fail = (error) => {
        if (!active) return;
        cancel(timer);
        onError(error);
        onState({ status: "error", tasks: [], error });
    };
    onState({ status: "loading", tasks: [], error: null });
    // An empty local cache is not proof that the server has no tasks.
    timer = schedule(() => fail({ code: "deadline-exceeded" }), 15000);
    try {
        unsubscribe = listen((snapshot) => {
            if (!active || terminal) return;
            if (snapshot.metadata.fromCache) {
                if (!awaitingServer) {
                    awaitingServer = true;
                    onState({ status: "loading", tasks: [], error: null });
                    timer = schedule(() => fail({ code: "deadline-exceeded" }), 15000);
                }
                return;
            }
            awaitingServer = false;
            cancel(timer);
            onState({
                status: "ready",
                tasks: snapshot.docs.map(d => ({ ...d.data(), id: d.id })),
                error: null,
            });
        }, (error) => {
            terminal = true;
            fail(error);
        });
    } catch (error) {
        terminal = true;
        fail(error);
    }
    return () => {
        active = false;
        cancel(timer);
        unsubscribe();
    };
}
