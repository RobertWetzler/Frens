using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cliq.Server.Migrations
{
    /// <inheritdoc />
    public partial class IndividualPosts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IndividualPosts",
                schema: "public",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PostId = table.Column<Guid>(type: "uuid", nullable: false),
                    SharedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndividualPosts", x => new { x.UserId, x.PostId });
                    table.ForeignKey(
                        name: "FK_IndividualPosts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalSchema: "public",
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_IndividualPosts_Posts_PostId",
                        column: x => x.PostId,
                        principalSchema: "public",
                        principalTable: "Posts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IndividualPosts_PostId",
                schema: "public",
                table: "IndividualPosts",
                column: "PostId");

            migrationBuilder.CreateIndex(
                name: "IX_IndividualPosts_UserId",
                schema: "public",
                table: "IndividualPosts",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IndividualPosts",
                schema: "public");
        }
    }
}
