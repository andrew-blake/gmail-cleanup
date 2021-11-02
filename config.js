// Helper method. One caveat to be aware of is that you should not start
// variables with two underscores - those are reserved for internal use.
function trash(thread) {
    thread.moveToTrash();
}

__setup = {
    queries: [
        // ["in:all -in:trash category:social older_than:15d -is:starred", trash],
        // ["in:all -in:trash category:updates older_than:15d -is:starred -label:Important-Label", trash],
        // ["in:all -in:trash category:promotions older_than:15d -is:starred -label:Company-News", trash],
        // ["in:all -in:trash category:forums older_than:90d -is:starred", trash],

        [
            '\
            (in:all -in:trash -in:spam category:social older_than:2d -is:starred) OR \
            (in:all -in:trash -in:spam -has:userlabels category:updates older_than:2d -is:starred -from:spatialbuzz.com) OR \
            (in:all -in:trash -in:spam -has:userlabels category:promotions older_than:2d -is:starred -from:spatialbuzz.com) OR \
            (in:all -in:trash -in:spam -has:userlabels category:forums older_than:2d -is:starred -from:spatialbuzz.com) OR \
            (-in:trash -in:spam label:monitoring-c01 older_than:2d -is:starred) OR \
            (-in:trash -in:spam label:monitoring-eu-west-1a older_than:2d -is:starred) OR \
            (-in:trash -in:spam label:monitoring-eu-west-1c older_than:2d -is:starred) \
            '
            , trash]
    ],
    notify: {
        subject: "Gmail Cleanup - Daily Filter Summary",
        body: "Number of emails processed: %c",
    },
};