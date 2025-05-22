using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    Username = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Posts",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Posts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Posts_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Comments",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ParentPostId = table.Column<string>(type: "text", nullable: true),
                    ParentCommentId = table.Column<string>(type: "text", nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comments", x => x.Id);
                    table.CheckConstraint("CK_Comment_HasOneParent", "(\"ParentPostId\" IS NOT NULL AND \"ParentCommentId\" IS NULL) OR (\"ParentPostId\" IS NULL AND \"ParentCommentId\" IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_Comments_Comments_ParentCommentId",
                        column: x => x.ParentCommentId,
                        principalSchema: "public",
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Comments_Posts_ParentPostId",
                        column: x => x.ParentPostId,
                        principalSchema: "public",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Comments_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PostUser",
                schema: "public",
                columns: table => new
                {
                    PostId = table.Column<string>(type: "text", nullable: false),
                    ViewersId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PostUser", x => new { x.PostId, x.ViewersId });
                    table.ForeignKey(
                        name: "FK_PostUser_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "public",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PostUser_Users_ViewersId",
                        column: x => x.ViewersId,
                        principalSchema: "public",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "public",
                table: "Users",
                columns: new[] { "Id", "Email", "Name", "Password", "Username" },
                values: new object[,]
                {
                    { "user1", "john@example.com", "John Doe", "$2a$11$mYNNrhJ3UXAEq.GSiwQuKel1e8SvWWX8m97a0z9S3klPeQjBRB/mK", "johndoe" },
                    { "user2", "jane@example.com", "Jane Smith", "$2a$11$wO5McvqbwyfAynTs028Akuyw8auYcZQOUdOncJIzD.d5psBRj6Hv2", "janesmith" },
                    { "user3", "bob@example.com", "Bob Wilson", "$2a$11$zp99clQpriv/Qekw.HHGSudntEX4q05IkHEvFaYMIUmjrUyjd7/3K", "bobwilson" }
                });

            migrationBuilder.InsertData(
                schema: "public",
                table: "Posts",
                columns: new[] { "Id", "Date", "Text", "UserId" },
                values: new object[,]
                {
                    { "post1", new DateTime(2024, 12, 6, 17, 4, 19, 940, DateTimeKind.Utc).AddTicks(9767), "Hello world! This is my first post.", "user1" },
                    { "post2", new DateTime(2024, 12, 7, 5, 4, 19, 940, DateTimeKind.Utc).AddTicks(9788), "Excited to join this platform!", "user2" },
                    { "post3", new DateTime(2024, 12, 7, 11, 4, 19, 940, DateTimeKind.Utc).AddTicks(9791), "Another day, another post. #coding", "user1" }
                });

            migrationBuilder.InsertData(
                schema: "public",
                table: "Comments",
                columns: new[] { "Id", "Date", "ParentCommentId", "ParentPostId", "Text", "UserId" },
                values: new object[,]
                {
                    { "comment1", new DateTime(2024, 12, 7, 17, 4, 19, 940, DateTimeKind.Utc).AddTicks(9882), null, "post1", "I am bob and I am commenting on a post", "user3" },
                    { "comment3", new DateTime(2024, 12, 7, 17, 4, 19, 940, DateTimeKind.Utc).AddTicks(9890), null, "post1", "I am Jane and I am commenting on Bob's post", "user2" }
                });

            migrationBuilder.InsertData(
                schema: "public",
                table: "PostUser",
                columns: new[] { "PostId", "ViewersId" },
                values: new object[,]
                {
                    { "post1", "user2" },
                    { "post1", "user3" },
                    { "post2", "user1" },
                    { "post2", "user3" }
                });

            migrationBuilder.InsertData(
                schema: "public",
                table: "Comments",
                columns: new[] { "Id", "Date", "ParentCommentId", "ParentPostId", "Text", "UserId" },
                values: new object[] { "childComment2", new DateTime(2024, 12, 7, 17, 4, 19, 940, DateTimeKind.Utc).AddTicks(9887), "comment1", null, "I am John responding to Bob", "user1" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ParentCommentId",
                schema: "public",
                table: "Comments",
                column: "ParentCommentId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_ParentPostId",
                schema: "public",
                table: "Comments",
                column: "ParentPostId");

            migrationBuilder.CreateIndex(
                name: "IX_Comments_UserId",
                schema: "public",
                table: "Comments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Posts_UserId",
                schema: "public",
                table: "Posts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PostUser_ViewersId",
                schema: "public",
                table: "PostUser",
                column: "ViewersId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Comments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "PostUser",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Posts",
                schema: "public");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "public");
        }
    }
}
